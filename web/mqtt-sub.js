const mqtt = require('mqtt');

const client = mqtt.connect('mqtts://594d608708f34a7b9607e86258c3b3ae.s1.eu.hivemq.cloud:8883', {
  username: 'frequency',
  password: 'Frequency@123'
});

client.on('connect', () => {
  console.log('Connected to HiveMQ');
  client.subscribe('courts/+/display');
});

client.on('message', (topic, message) => {
  console.log(`\n--- NEW PAYLOAD ON ${topic} ---`);
  console.log(message.toString());
  console.log('--------------------------------\n');
});
