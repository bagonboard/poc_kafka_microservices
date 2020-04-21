const kafka = require("kafka-node");
const APM = require('elastic-apm-node');
const { KafkaClient } = kafka;
const port = 3000;

const apm = APM.start({
  serverUrl: 'http://localhost:8200',
  serviceName: `backend`,
  //logLevel: 'trace'
});

module.exports = ({ producer: producerType }) => {

  const { sendToKafka, producerFactory } = require("./helpers")(apm, process);

  const express = require('express');
  const app = express();
  app.disable('etag');

  const producer = producerFactory(producerType);

  app.get('/new-customer', async (req, res) => {
    const { email } = req.query;
    await sendToKafka(producer, 'user-creation', { email });
    setTimeout(() => {
      process.send({ cmd: 'log', args: ['new customer created'] });
      res.send({ result: 'new customer created' });
    }, 30);
  });

  process.on('uncaughtException', (err, origin) => {    
    process.send({ cmd: 'log', args: ['uncaughtException', err.message, origin] });
  });

  app.listen(port, () => process.send({ cmd: 'log', args: [`Backend listening at http://localhost:${port}`] }));

};