const fs = require("fs")
const inquirer = require('inquirer');
const colors = require("colors");
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;

const colorWorkers = ['red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white', 'gray'];
const services = JSON.parse(fs.readFileSync('./services.json', 'utf8'));

const init = (amount, service) => {
  if (cluster.isMaster) {
    console.log(`Master ${process.pid} is running`);
    // Fork workers.
    function messageHandler(service, id, msg) {
      if (msg.cmd && msg.cmd === 'log') {
        const { args } = msg
        console.log(colors[colorWorkers[parseInt(id, 10) - 1]](`(${service}) - Worker (${id}) -`), ...args);
      }
    }
    for (let i = 0; i < amount; i++) {
      cluster.fork({ WORKER_ID: i + 1, SERVICE: service });
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
    let subscriptions = services[process.env.SERVICE];
    require('./service')({ subscriptions, service: process.env.SERVICE })
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
    ])
    .then((answers) => {
      const { instances, service } = answers;
      init(instances, service);
    });
} else {
  init();
}

process.on('uncaughtException', (err, origin) => {
  console.log('err=', err);
  console.log('origin=', origin);
});