//configurations for the app....
var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var router = require('./routes/index');

var { clientID, clientSecret, returnAValidToken } = require('./config/config')

const schedule = require('node-schedule');
const { testScheduledUpdates } = require('./scripts/scheduledUpdates');
var app = express();

let thisToken;

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.set('debug', true);

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

let token;

// Middleware to check token expiration and refresh if necessary
app.use(async (req, res, next) => {
  req.token = await returnAValidToken(clientID, clientSecret); 
  thisToken = await req.token; 
  next();
});

app.use('/', router);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

// Schedule the update every 3 hours
schedule.scheduleJob('*/1 * * * *', async() => {
  console.log("this schedule function is called")
  testScheduledUpdates(thisToken);
});

let tokenOnce;
const asyncMiddleware = async (req, res, next) => {
  tokenOnce = await returnAValidToken(clientID, clientSecret); 
}; 

testScheduledUpdates(tokenOnce);

module.exports = app;