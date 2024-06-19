//configurations for the app....
var createError = require("http-errors");
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
var router = require("./routes/index");
const WebSocket = require('ws');


const schedule = require("node-schedule");
const { scheduledUpdates } = require("./scripts/scheduledUpdates");
const { deleteOldManualUpdates } = require("./sequelizer/controller/event.controller");

var app = express();

const server = require('http').createServer(app);
const wss = new WebSocket.Server({ server });

let updateOnce = true;

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "jade");
app.set("debug", true);

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

// Middleware to check token expiration and refresh if necessary
app.use(async (req, res, next) => {

  req.wss = wss;

  if (updateOnce) {
    updateOnce = false;

    await deleteOldManualUpdates();
    // await new Promise(resolve => setTimeout(resolve, 60000));
    await scheduledUpdates("TIER 1");
    // await new Promise(resolve => setTimeout(resolve, 60000));
    // await scheduledUpdates("TIER 2");
    // await new Promise(resolve => setTimeout(resolve, 60000));
    // await scheduledUpdates("TIER 3");
  }
  next();
});

app.use("/", router);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render("error");
});

// Schedule the update every 8 hours, 24 hours, and 1 week, respectively
//8AM
//8PM
schedule.scheduleJob('0 */12 * * *', async () => {
  console.log("Tier 1 schedule function is called");
  await scheduledUpdates("TIER 1");
});

//3PM MONDAYS
schedule.scheduleJob("0 7 * * 1", async () => {
  console.log("Deleting old manual updates..");
    await deleteOldManualUpdates();
});

//4PM DAILY
schedule.scheduleJob("0 8 */1 * *", async () => {
  console.log("Tier 2 schedule function is called");
  await scheduledUpdates("TIER 2");
});

//4PM, MONDAYS
schedule.scheduleJob("0 8 * * 1", async () => {
  console.log("Tier 3 schedule function is called");
  await scheduledUpdates("TIER 3");
});

module.exports = app;
