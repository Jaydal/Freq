const mqtt = require('mqtt');
require('dotenv').config({ path: '.env.local' });
const client = mqtt.connect(process.env.MQTT_BROKER_URL, {
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD,
  port: 8883,
  protocol: 'mqtts'
});
client.on('connect', () => {
  client.subscribe('courts/+/display');
  console.log('Subscribed to courts/+/display');
  setTimeout(() => { client.end(); }, 3000);
});
client.on('message', (topic, message) => {
  console.log(`[${topic}]:`, JSON.stringify(JSON.parse(message.toString()), null, 2));
});
