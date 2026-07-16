if(DEFINED ENV{IDF_PATH})
    # Gather all source files in src/
    file(GLOB_RECURSE app_sources "*.c")
    
    # Exclude simulator-specific files and mock data
    file(GLOB_RECURSE sim_sources "hal_sim/*.c" "main.c" "data/mock/*.c")
    if(sim_sources)
        list(REMOVE_ITEM app_sources ${sim_sources})
    endif()

    idf_component_register(
        SRCS ${app_sources}
        INCLUDE_DIRS 
            "." 
            ".."
        REQUIRES 
            "lvgl" 
            "esp_lcd_touch_gt911" 
            "nvs_flash" 
            "esp_http_client" 
            "mqtt" 
            "esp_lcd" 
            "driver" 
            "esp_timer"
            "json"
            "esp_http_server"
    )
endif()
