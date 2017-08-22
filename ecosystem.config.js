module.exports = {
  apps: [{
    name: 'ggnode',
    script: './index.js'
  }],
  deploy: {
    production: {
      user: 'ubuntu',
      host: 'ec2-54-255-201-52.ap-southeast-1.compute.amazonaws.com',
      key: '~/.ssh/gg1-sg.pem',
      ref: 'origin/master',
      repo: 'git@github.com:leppryt/ggNode.git',
      path: '/home/ubuntu/ggnode',
      'post-deploy': 'npm install && pm2 startOrRestart ecosystem.config.js'
    }
  }
}