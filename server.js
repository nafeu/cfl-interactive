const questionsState = {
  unapprovedQuestions: [],
  approvedQuestions: [],
  numSubmissions: 0,
  getId: function() {
    return this.numSubmissions++;
  }
}

const quizState = {
  data: [],
  labels: [],
  active: false,
  setQuizMode: function(newLabels) {
    var self = this
    self.data = []
    newLabels.forEach(function(){ self.data.push(0) })
    self.labels = newLabels
    self.active = true
  },
}

const ticketState = {
  results: [],
  active: false,
}

const express = require('express')
const path = require('path')
const app = express()
const server = require('http').Server(app)
const bodyParser = require('body-parser')
const io = require('socket.io')(server)
const fs = require('fs')
const api = require('./components/api')(io, questionsState, quizState, ticketState)
const socketEvents = require('./components/socket-events')

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

// Environment configs
const env = process.env.NODE_ENV || 'dev';

console.log(`[ server.js ] Running app in ${env} environment`)

// Server configs
let serverPort

// Avoid EADDRINUSE in chai-http tests
if (process.env.TEST_MODE) {
  serverPort = 8080
} else {
  serverPort = 8000
}

server.listen(process.env.PORT || serverPort, () => {
  console.log(`[ server.js ] Listening on port ${server.address().port}`)
});

// Socket.io configs
io.set('heartbeat timeout', 4000)
io.set('heartbeat interval', 2000)
socketEvents.use(io, questionsState, quizState, ticketState)

// Express server configs
app.use(bodyParser.urlencoded({extended: true}))
app.use(bodyParser.json());
app.set('view engine', 'ejs')
app.use('/api', api)

app.get('/', function(req, res) {
  res.render('pages/viewer');
});

app.get('/instructor', function(req, res) {
  res.render('pages/instructor');
});

app.get('/attendee', function(req, res) {
  res.render('pages/attendee');
});

app.post('/exit', (req, res) => {
  ticketState.results.push(req.body);
  console.log(ticketState);
  res.render('pages/exit');
})

app.get('/exit', (req, res) => {
  res.json(ticketState);
})

app.use(express.static(path.join(__dirname, 'static')))

module.exports = server

// // Debug Polling
// const debugPolling = setInterval(function(){
//   console.log("[ server.js ] questionsState: ");
//   console.log(questionsState);
// }, 5000)