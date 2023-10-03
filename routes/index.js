var express = require('express');
var router = express.Router();
var { executeScraper } = require('../services/scraper')
var { executeUpdates } = require('../services/guestyUpdates')
var { saveRecord, updateRecord, deleteRecord, findRecords } = require('../sequelizer/controller/controller')

router.get('/', function(req, res, next) {
  res.render('oneListing');

});

router.get('/oneListing', function(req, res, next) {
  res.redirect('/');

});

router.get('/allListings', function(req, res, next) {
  res.render('allListings');

});

router.get('/scheduledUpdates', function(req, res, next) {
  res.render('scheduledUpdates');

});

router.get('/resorts', function(req, res, next) {
  res.render('resorts');

});

router.get('/events', function(req, res, next) {
  res.render('events');

});


router.get('/getlistings', async(req, res, next) => {
  var resortID = req.query.resort_id;
  var suiteType = req.query.suite_type;
  var months = req.query.months;

  console.log(resortID)
  console.log(suiteType)
  console.log(months)

  res.redirect('/');

  const token = await req.token;

  // const data = {
  //   execType: "ONE_LISTING",
  //   resortID: resortID,
  //   execStatus: "UPDATING_DONE",
  // }

  // const recordObject = await saveRecord(data, "execution");

  // const updatedData = {
  //   execStatus: "DONE_SCRAPING",
  // }

  // await new Promise(resolve => setTimeout(resolve, 60000));

  //FINDS ALL RECORDS WITH A SPECIFIF EXECTYPE
  condJson = {
    execType: "ONE_LISTING"
  }
  const foundRecords = await findRecords(condJson, "execution")
  for (const f of foundRecords){
    console.log(JSON.stringify(f, null, 2));
  }

  // forUpdate = await executeScraper(resortID, suiteType, months);

  // console.log("PADUNG NA UPDATE")

  // options = {
  //   'Studio': 0,
  //   '1 Bedroom': 1,
  //   '2 Bedroom': 2,
  //   '3 Bedroom': 3,
  //   '4 Bedroom': 4,
  // } 

  // if (forUpdate !== null) {
  //   address = forUpdate.address;
  //   updatedAvail = forUpdate.updatedAvail;

  //   result = await executeUpdates(token, address, updatedAvail, options[suiteType]);
  //   console.log(result);
  // }



});

module.exports = router;

