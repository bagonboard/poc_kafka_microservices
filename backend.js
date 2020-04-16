const kafka = require("kafka-node");
const APM = require('elastic-apm-node');
const { Producer, KafkaClient } = kafka;
const { sendToKafka } = require("./helpers");
const port = 3000;

const apm = APM.start({
  serverUrl: 'http://localhost:8200',
  serviceName: `backend`,
  //logLevel: 'trace'
});

const express = require('express');
const app = express();
app.disable('etag');

const client = new KafkaClient({ kafkaHost: 'localhost:9092' });
const producer = new Producer(client);
producer.on('ready', () => {
  console.log('Backend - Kafka producer ready');
});
producer.on('error', (error) => {
  console.log('Backend - Kafka producer error', error);
});

app.get('/new-customer', async (req, res) => {
  const { email } = req.query;
  await sendToKafka(apm, producer, 'user-creation', { email });
  setTimeout(() => {
    console.log('new customer created');
    res.send({ result: 'new customer created' });
  }, 30);
});

process.on('uncaughtException', (err, origin) => {
  console.log('err=', err);
  console.log('origin=', origin);
});

app.listen(port, () => console.log(`Backend listening at http://localhost:${port}`));