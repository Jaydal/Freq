#include "pn532_i2c.h"
#include "driver/i2c.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_log.h"
#include "ui/ui_app.h"
#include <string.h>
#include <stdio.h>

#define I2C_PORT 1 // Use second I2C controller
#define PN532_ADDR 0x24
#define PN532_SDA_PIN 43
#define PN532_SCL_PIN 44

static const char *TAG = "pn532";
static bool s_pn532_online = false;

bool pn532_is_online(void) {
    return s_pn532_online;
}

static bool pn532_is_ready(void) {
    uint8_t status = 0;
    esp_err_t err = i2c_master_read_from_device(I2C_PORT, PN532_ADDR, &status, 1, pdMS_TO_TICKS(10));
    return (err == ESP_OK && status == 0x01);
}

static bool pn532_wait_ready(uint32_t timeout_ms) {
    uint32_t start = xTaskGetTickCount() * portTICK_PERIOD_MS;
    while ((xTaskGetTickCount() * portTICK_PERIOD_MS) - start < timeout_ms) {
        if (pn532_is_ready()) return true;
        vTaskDelay(pdMS_TO_TICKS(10));
    }
    // We only print error if we were waiting for a very short operation.
    // For scanning (which takes up to 1000ms), a timeout might just mean "no card yet".
    if (timeout_ms < 1000) {
        ESP_LOGE(TAG, "pn532_wait_ready timed out after %d ms", (int)timeout_ms);
    }
    return false;
}

static bool pn532_send_command(const uint8_t *cmd, uint8_t cmd_len) {
    uint8_t packet[32];
    if (cmd_len > 20) return false;
    
    packet[0] = 0x00; // Preamble
    packet[1] = 0x00; // Start code 1
    packet[2] = 0xFF; // Start code 2
    packet[3] = cmd_len + 1; // Length
    packet[4] = (uint8_t)(~(cmd_len + 1) + 1); // Length checksum
    packet[5] = 0xD4; // Host to PN532
    
    uint8_t sum = 0xD4;
    for (uint8_t i = 0; i < cmd_len; i++) {
        packet[6 + i] = cmd[i];
        sum += cmd[i];
    }
    
    packet[6 + cmd_len] = (uint8_t)(~sum + 1); // Data checksum
    packet[7 + cmd_len] = 0x00; // Postamble
    
    esp_err_t err = i2c_master_write_to_device(I2C_PORT, PN532_ADDR, packet, 8 + cmd_len, pdMS_TO_TICKS(50));
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "pn532_send_command I2C write failed: %d", err);
        return false;
    }
    return true;
}

static bool pn532_read_ack(void) {
    if (!pn532_wait_ready(1000)) {
        ESP_LOGE(TAG, "pn532_read_ack: wait_ready failed");
        return false;
    }
    uint8_t ack_buf[7];
    esp_err_t err = i2c_master_read_from_device(I2C_PORT, PN532_ADDR, ack_buf, 7, pdMS_TO_TICKS(10));
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "pn532_read_ack: I2C read failed: %d", err);
        return false;
    }
    
    // Ack is 00 00 FF 00 FF 00 (ignoring first byte status)
    if (ack_buf[1] == 0x00 && ack_buf[2] == 0x00 && ack_buf[3] == 0xFF && 
        ack_buf[4] == 0x00 && ack_buf[5] == 0xFF && ack_buf[6] == 0x00) {
        return true;
    }
    ESP_LOGE(TAG, "pn532_read_ack: invalid ack bytes: %02X %02X %02X %02X %02X %02X %02X",
             ack_buf[0], ack_buf[1], ack_buf[2], ack_buf[3], ack_buf[4], ack_buf[5], ack_buf[6]);
    return false;
}

static bool pn532_read_response(uint8_t *resp, uint8_t *resp_len, uint8_t max_len) {
    if (!pn532_wait_ready(1000)) {
        ESP_LOGE(TAG, "pn532_read_response: wait_ready failed");
        return false;
    }
    uint8_t buf[64];
    esp_err_t err = i2c_master_read_from_device(I2C_PORT, PN532_ADDR, buf, sizeof(buf), pdMS_TO_TICKS(50));
    if (err != ESP_OK) return false;
    
    // buf[0] is status (0x01)
    if (buf[1] != 0x00 || buf[2] != 0x00 || buf[3] != 0xFF) return false;
    uint8_t len = buf[4];
    if (len > max_len + 1) return false; // +1 for 0xD5
    
    for (uint8_t i = 0; i < len - 1; i++) {
        resp[i] = buf[7 + i]; // 7 is start of PD0
    }
    *resp_len = len - 1;
    return true;
}

static void pn532_task(void *arg) {
    (void)arg;
    ESP_LOGI(TAG, "PN532 task started");
    
    uint8_t resp[16];
    uint8_t rlen;

    // Retry initialization until successful
    while (1) {
        // Wake up the PN532 (it starts in low power mode)
        uint8_t dummy = 0;
        i2c_master_read_from_device(I2C_PORT, PN532_ADDR, &dummy, 1, pdMS_TO_TICKS(10));
        vTaskDelay(pdMS_TO_TICKS(50)); // Wait for chip to fully wake up

        // 1. Get Firmware Version (0x02) to verify connection
        uint8_t fw_cmd[] = {0x02};
        if (!pn532_send_command(fw_cmd, sizeof(fw_cmd)) || !pn532_read_ack()) {
            ESP_LOGE(TAG, "Failed to get Firmware Version. Retrying in 2s...");
            vTaskDelay(pdMS_TO_TICKS(2000));
            continue;
        }
        pn532_read_response(resp, &rlen, sizeof(resp));
        if (rlen >= 4) {
            ESP_LOGI(TAG, "Found PN5%02X! Firmware v%d.%d", resp[0], resp[1], resp[2]);
        }

        // 2. SAM configuration
        // Normal mode, timeout 0x02 (100ms), NO IRQ
        uint8_t sam_cmd[] = {0x14, 0x01, 0x02, 0x00}; 
        if (pn532_send_command(sam_cmd, sizeof(sam_cmd)) && pn532_read_ack()) {
            pn532_read_response(resp, &rlen, sizeof(resp));
            ESP_LOGI(TAG, "PN532 SAM configured successfully");
            break;
        }
        
        ESP_LOGE(TAG, "Failed to configure SAM. Retrying in 2s...");
        vTaskDelay(pdMS_TO_TICKS(2000));
    }
    
    uint32_t last_scan = 0;
    
    while(1) {
        vTaskDelay(pdMS_TO_TICKS(500));
        
        uint8_t poll_cmd[] = {0x4A, 0x01, 0x00}; // Max 1 target, Baud 106 kbps (Type A)
        if (!pn532_send_command(poll_cmd, sizeof(poll_cmd))) continue;
        if (!pn532_read_ack()) continue;
        
        // Give it plenty of time (1500ms) to scan
        bool is_ready_now = pn532_wait_ready(1500);
        
        if (!is_ready_now) {
            // If it timed out, maybe no card was found or chip is busy.
            // Don't mark offline unless it fails to acknowledge I2C entirely.
            uint8_t dummy;
            s_pn532_online = (i2c_master_read_from_device(I2C_PORT, PN532_ADDR, &dummy, 1, pdMS_TO_TICKS(10)) == ESP_OK);
            continue;
        } else {
            s_pn532_online = true;
        }
        
        if (is_ready_now) {
            if (pn532_read_response(resp, &rlen, sizeof(resp))) {
                if (rlen >= 2 && resp[0] == 0x4B && resp[1] == 1) {
                    uint8_t uid_len = resp[6];
                    if (uid_len > 0 && uid_len <= 10 && (7 + uid_len <= rlen)) {
                        char hex_str[32] = {0};
                        for (int i = 0; i < uid_len; i++) {
                            sprintf(&hex_str[i * 2], "%02X", resp[7 + i]);
                        }
                        
                        if ((xTaskGetTickCount() * portTICK_PERIOD_MS) - last_scan > 3000) {
                            ESP_LOGI(TAG, "Scanned NFC: %s", hex_str);
                            ui_app_handle_scan(hex_str);
                            last_scan = xTaskGetTickCount() * portTICK_PERIOD_MS;
                        }
                    }
                }
            }
        }
    }
}

void pn532_start_task(void) {
    const i2c_config_t cfg = {
        .mode             = I2C_MODE_MASTER,
        .sda_io_num       = PN532_SDA_PIN,
        .scl_io_num       = PN532_SCL_PIN,
        .sda_pullup_en    = GPIO_PULLUP_ENABLE,
        .scl_pullup_en    = GPIO_PULLUP_ENABLE,
        .master.clk_speed = 100000,
    };
    ESP_ERROR_CHECK(i2c_param_config(I2C_PORT, &cfg));
    ESP_ERROR_CHECK(i2c_driver_install(I2C_PORT, I2C_MODE_MASTER, 0, 0, 0));
    ESP_LOGI(TAG, "Initialized independent I2C bus on SDA=%d, SCL=%d for PN532", PN532_SDA_PIN, PN532_SCL_PIN);

    xTaskCreate(pn532_task, "pn532", 4096, NULL, 4, NULL);
}
