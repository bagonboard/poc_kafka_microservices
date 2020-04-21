const fs = require("fs")
const inquirer = require('inquirer');
const colors = require("colors");
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;
const colorWorkers = ['red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white', 'gray'];
const services = JSON.parse(fs.readFileSync('./services.json', 'utf8'));

process.on('uncaughtException', (err, origin) => {
  console.log('err=', err);
  console.log('origin=', origin);
});

const init = ({ instances, service, producer, consumer } = {}) => {
  if (cluster.isMaster) {
    console.log(`Master ${process.pid} is running`);
    function messageHandler(service, id, msg) {
      if (msg.cmd && msg.cmd === 'log') {
        const { args } = msg
        console.log(colors[colorWorkers[parseInt(id, 10) - 1]](`(${service}) - Worker (${id}) -`), ...args);
      }
    }
    for (let i = 0; i < instances; i++) {
      cluster.fork({ WORKER_ID: i + 1, SERVICE: service, PRODUCER: producer, CONSUMER: consumer });
    }
    cluster.on('exit', (worker, code, signal) => {
      console.log('code=', code);
      console.log('signal=', signal);
      console.log(`worker ${worker.process.pid} died`);
    });
    for (const id in cluster.workers) {
      cluster.workers[id].on('message', (msg) => messageHandler(service, id, msg));
      cluster.workers[id].on('error', (err) => {
        console.log('error', err)
      })

    }
  } else {
    const { SERVICE: service, PRODUCER: producer, CONSUMER: consumer } = process.env;
    const subscriptions = services[service];
    const fileToRequire = service === 'backend' ? './backend' : './service';
    require(fileToRequire)({ subscriptions, service, producer, consumer });
  }
}

if (cluster.isMaster) {
  inquirer
    .prompt([
      {
        type: 'list',
        message: 'Service to launch:',
        choices: Object.keys(services),
        name: 'service'
      },
      {
        type: 'list',
        message: 'Instances:',
        choices: Array.from(Array(numCPUs).keys()).map(n => n + 1),
        name: 'instances'
      },
      {
        type: 'list',
        message: 'Type of producer:',
        choices: ['Producer', 'HighLevelProducer'],
        name: 'producer'
      },
      {
        type: 'list',
        message: 'Type of consumer:',
        choices: ['Consumer', 'ConsumerGroup'],
        name: 'consumer',
        when: ({ service }) => service !== 'backend'
      },

    ])
    .then(init);
} else {
  init();
}
