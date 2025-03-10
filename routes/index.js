const express = require('express');
const { sequelize } = require("../config/config");
const { Op } = require("sequelize");
const router = express.Router();
const { v5: uuidv5 } = require('uuid');
const { eventEmitter } = require('../scripts/scheduledUpdates');
const { format } = require('date-fns');
const { formatInTimeZone } = require('date-fns-tz');
const { joinTwoTables, countRecords, findLikeRecords, findByPk, updateRecord, setupCreateHook, setupUpdateHook, setupDeleteHook, setupBulkCreateHook, removeHooks, deleteRecord } = require('../sequelizer/controller/controller');
const { addToQueue, resourceIntensiveTask, processVerification } = require('../scripts/queueProcessor');
const { findOrCreateAResort } = require('../scripts/scrapeAndUpdate');
const { createAnEvent, updateEventStatus } = require('../sequelizer/controller/event.controller');
const { updateSingleListing } = require('../services/guestyUpdates')
const { resendSmsCode } = require('../services/scraper')


let isVerified = false;

router.get('/', async(req, res, next) => {
  const amount = await countRecords("execution", {execType:"ONE_RESORT"});
  res.render('oneListing', { records : amount } );
});

router.get('/oneListing', async(req, res, next) => {
  res.redirect('/');
});

router.get('/allListings', function(req, res, next) {
  res.render('allListings');

});

router.get('/scheduledUpdates', async(req, res, next) => {
  const amount = await countRecords("execution", {execType:"SCHEDULED"});
  res.render('scheduledUpdates', { records : amount } );
});

router.get('/resorts', async(req, res, next) => {
  const amount = await countRecords("resorts", {});
  res.render('resorts', { records : amount } );

});

router.get('/events', async(req, res, next) => {
  const amount = await countRecords("resorts", {});
  res.render('events', { records : amount } );

});

router.get('/calendarUpdate', async(req, res, next) => {
  const amount = await countRecords("execution", { execType:"MANUAL_UPDATE" } );
  res.render('calendarUpdate', { records : amount } );

});

router.get('/duplicateListingLinks', (req, res) => {
  const links = req.query.links.split(",");
  res.render('duplicateListingLinks', { links });
});

///////////////////////////////////////////////////////////////////////////////
// For verification  
///////////////////////////////////////////////////////////////////////////////

router.post('/sendOTP', async(req, res, next) => {
  let verOTP = req.body.OTP;
  let execID = req.body.execID;

  console.log(verOTP);
  console.log(execID);

  const eventCond = {
    execID: execID
  }

  let record = await joinTwoTables("execution", "resorts", eventCond, [], null, null);
  let queueType = record[0].execType === "ONE_RESORT" ? "ONE TIME" : record[0].resort.notes === "TIER 1" ? "TIER 1" : "TIER 2";

  let eventFound = await findByPk(execID, "execution");

  if (isVerified === false) {
    if (verOTP === "") {
      const verified = false;
      const message = "empty";
      res.json({ verified, message });  
    }
    else {
      try {
        // Trigger the login process asynchronously
        processVerification(verOTP, queueType)
          .then(loggedIn => {
            let event = eventFound

            isVerified = loggedIn;  
            const message = "successOrFail";

            if (isVerified){
              updateEventStatus(event, "SCRAPING");
            } else {
              if (loggedIn === "MAINTENANCE") {
                updateEventStatus(event, "MAINTENANCE");
              } else if (loggedIn === null) {
                updateEventStatus(event, "OTP_ERROR");
              } else {
                updateEventStatus(event, "UNVERIFIED");
              }
            }

            res.json({ loggedIn, message });

          })
          .catch(error => {
            console.error('Send OTP error:', error);
            res.status(500).json({ error: 'Internal Server Error' });
          });
      } catch (error) {
        console.error('Error triggering sending OTP:', error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    }
  } else {
    const verified = true;
    const message = "already verified";
    res.json({ verified, message });
  }

});

router.post('/resendOTP', async(req, res, next) => {
  if (isVerified === false) {
    try {
      // Trigger the login process asynchronously
      let execID = req.body.execID;

      const eventCond = {
        execID: execID
      }
    
      let record = await joinTwoTables("execution", "resorts", eventCond, [], null, null);
      let queueType = record[0].execType === "ONE_RESORT" ? "ONE TIME" : record[0].resort.notes === "TIER 1" ? "TIER 1" : "TIER 2";

      resendSmsCode(queueType)
        .then(needsVerify => {  
          let eventCreated = findByPk(req.body.execID, "execution");
          res.json({ needsVerify });

          if (needsVerify === "MAINTENANCE") {
            updateEventStatus(eventCreated, "MAINTENANCE");
          } 
        })
        .catch(error => {
          console.error('Resend OTP error:', error);
          res.status(500).json({ error: 'Internal Server Error' });
        });
    } catch (error) {
      console.error('Error triggering login:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  } else {
    const needsVerify = false;
    res.json({ needsVerify });
  }

});


///////////////////////////////////////////////////////////////////////////////
// Endpoints for forms
///////////////////////////////////////////////////////////////////////////////
router.post('/one', async(req, res, next) => {

  let resortID = (req.body.resort_id).trim();
  let suiteType = (req.body.suite_type).trim();
  let months = (req.body.months).trim() > 12 ? 12 : (req.body.months).trim();

  let resort = await findOrCreateAResort(resortID, suiteType); 
  let eventCreated = ( resort !== null) ? await createAnEvent(resort.resortRefNum, months) : null;
  
  if (eventCreated !== null){
    try {

      // Trigger the login process asynchronously
      addToQueue(resourceIntensiveTask, () => {
        console.log('Task completed');
      }, "ONE TIME", resortID, suiteType, months, resort, eventCreated)
        .then(loggedIn => {
          let execID = eventCreated.execID;

          isVerified = loggedIn;
          
          if (loggedIn === "MAINTENANCE") {
            updateEventStatus(eventCreated, "MAINTENANCE");
          } else if (loggedIn === null) {
            updateEventStatus(eventCreated, "LOGIN_ERROR");
          }

          res.json({ loggedIn, execID });
        })
        .catch(error => {
          console.error('One error:', error);
          res.status(500).json({ error: 'Internal Server Error' });
        });
    } catch (error) {
      console.error('Error triggering login:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }

  } else {
    console.log("Creating a resort or execution record failed.")
  }
  

});

router.post('/manualUpdate', async(req, res, next) => {

  let resortID = (req.body.resort_id).trim();
  let suiteType = (req.body.suite_type).trim();
  let startDate = (req.body.start_date).trim();
  let endDate = (req.body.end_date).trim();

  let resort = await findOrCreateAResort(resortID, suiteType); 
  

  await updateSingleListing(resort, startDate, endDate);

  res.redirect('/calendarUpdate');
  

});

router.post('/tier/update', async(req, res, next) => {
  let resortRefNums = req.body.checkboxes;
  let tier = req.query.tier;


  for ( const resortRef of resortRefNums ) {
    let resort = await findByPk(resortRef, "resorts");

    const updateResort = {
      notes: tier
    }

    await updateRecord(updateResort, resort);
  }

  console.log("Tiers updated!!");

});

///////////////////////////////////////////////////////////////////////////////
// For retrying  
///////////////////////////////////////////////////////////////////////////////

router.get('/retry', async(req, res, next) => {

  let resortID = (req.query.resort_id).trim();
  let suiteType = (req.query.suite_type).trim();
  let months = (req.query.months).trim() > 12 ? 12 : (req.query.months).trim();

  let execID = (req.query.execID).trim();
  
  let resort = await findOrCreateAResort(resortID, suiteType); 
  let eventCreated = await findByPk(execID, "execution");

  const eventCond = {
    execID: execID
  }

  let record = await joinTwoTables("execution", "resorts", eventCond, [], null, null);
  let queueType = record[0].execType === "ONE_RESORT" ? "ONE TIME" : record[0].resort.notes === "TIER 1" ? "TIER 1" : "TIER 2";

  await updateEventStatus(eventCreated, "SCRAPING");
  
  if (eventCreated !== null){
    try {
      // Trigger the login process asynchronously
      addToQueue(resourceIntensiveTask, () => {
        console.log('Task completed');
      }, queueType, resortID, suiteType, months, resort, eventCreated)
        .then(loggedIn => {

          isVerified = loggedIn;
          
          if (loggedIn === "MAINTENANCE") {
            updateEventStatus(eventCreated, "MAINTENANCE");
          } else if (loggedIn === null) {
            updateEventStatus(eventCreated, "LOGIN_ERROR");
          }

          res.json({ loggedIn, execID });
        })
        .catch(error => {
          console.error('Retry error:', error);
          res.status(500).json({ error: 'Internal Server Error' });
        });
    } catch (error) {
      console.error('Error triggering login:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }

  } else {
    console.log("Creating a resort or execution record failed.")
  }

});

// For removing manual update record (this date block is updated again with the scheduled udpates)
router.get('/remove', async(req, res, next) => {

  const execID = (req.query.execID).trim();
  const event = await findByPk(execID, "execution");
  
  try {
    await deleteRecord(event);
  } catch (error) {
    console.error("Error deleting manual event: ", error.message);
  }

  res.redirect('/calendarUpdate');

});

///////////////////////////////////////////////////////////////////////////////
// WEBSOCKET                
///////////////////////////////////////////////////////////////////////////////

const mapExecutionData = async(data, endpoint) => {
  try {
    let formattedRecords = [];
    if (Array.isArray(data)) {
      if (endpoint.includes('resorts')) {
        formattedRecords = data.map(item => ({
          ...item.toJSON(),  
          resortRefNum: item.resortRefNum === null? "To be updated": item.resortRefNum,
          listingID: item.listingID === null? "To be updated": item.listingID,
          resortID: item.resortID === null? "To be updated": item.resortID,
          resortName: item.resortName === null? "To be updated": item.resortName,
          listingName: item.listingName === null? "To be updated": item.listingName,
          unitType: item.unitType === null? "To be updated": item.unitType,
          notes: item.notes === null? "": item.notes,
    
        }));
      } else {
        formattedRecords = data.map(item => ({
            ...item.toJSON(), 
            resort: {
              listingName: item.resort.listingName === null? "To be updated": item.resort.listingName, 
              listingID: item.resort.listingID === null? "To be updated": item.resort.listingID, 
              resortName: item.resort.resortName === null? "To be updated": item.resort.resortName, 
              unitType: item.resort.unitType === null? "To be updated": item.resort.unitType, 
              resortID: item.resort.resortID === null? "To be updated": item.resort.resortID, 
            }, 
            execID: item.execID === null? "To be updated": item.execID, 
            datetoUpdate: format(new Date(item.datetoUpdate), 'yyyy-MM-dd'),
            createdAt: formatInTimeZone(new Date(item.createdAt), 'America/New_York', 'yyyy-MM-dd HH:mma'),
            updatedAt: formatInTimeZone(new Date(item.updatedAt), 'America/New_York', 'yyyy-MM-dd HH:mma'),
        }));
      }
    }

    return formattedRecords;
  } catch (error) {
    console.error("Error mapping the records: ", error);
    return [];
  }
}

const WebSocket = require('ws');
const wss = new WebSocket.Server({ port : 3003 });
const c = new Map();
const crypto = require('crypto');
wss.on('connection', async(ws) => {
  try {
    //for hook ids
    const id = crypto.randomUUID();
    let tabID;
    
    ws.on('message', async function message(data) {
      console.log('received: %s', data);

      let values = JSON.parse(data);
      let endpoint = values.endpoint;

      let limit = values.limit;
      let offset = values.offset;
      let search = values.search;

      tabID = values.tabID;

      c.forEach(async(value) => {
        if(value.tabID === tabID) {
          await removeHooks("execution", ['afterCreate', 'afterUpdate', 'afterDestroy', 'afterBulkCreate'], value.id);
        }
      });

      let update = async () => {
        try {
          const { eventCond, order } = getEventCondAndOrder(endpoint, search);

          let records = await returnData(endpoint, eventCond, order, limit, offset, search);

          let formattedRecords = await mapExecutionData(records, endpoint);
      
          ws.send(JSON.stringify({ data : formattedRecords, type: endpoint }));
    
        } catch (error) {
          console.error("An error happened while joining records: ", error);
        }
      };

      await setupUpdateHook("execution", update, id);
      await setupCreateHook("execution", update, id);
      await setupDeleteHook("execution", update, id);
      await setupBulkCreateHook("execution", update, id);

      c.set(ws, { id, tabID });
    
      update();
    
    });

    const onModalStateChanged = (data) => {
      ws.send(JSON.stringify({ data : data }));
    };

    eventEmitter.on('modalStateChanged', onModalStateChanged);

    ws.on('close', async() => {
      //remove hook using ws
      //delete from map
      const hookID = c.get(ws).id;
      await removeHooks("execution", ['afterCreate', 'afterUpdate', 'afterBulkCreate'], hookID);
      eventEmitter.removeListener('modalStateChanged', onModalStateChanged);
      c.delete(ws);
      console.log("connection removed")
    })
  } catch (error) {
    console.error("An error happened: ", error);
  }

})

async function returnData(endpoint, eventCond, order, limit, offset, search) {
  let records;

  if(endpoint.includes('resorts')) {
    records = await findLikeRecords(search, "resorts", order, limit, offset);
  } else {
    records = await joinTwoTables("execution", "resorts", eventCond, order, limit, offset);
  }

  return records;
}

function getEventCondAndOrder(endpoint, search) {
  let eventCond, order;

  if(endpoint.includes('scheduledUpdates')) {
      eventCond = {
        execType: "SCHEDULED"
      }

      order = [
        [sequelize.col("createdAt"), 'DESC'],  
        [sequelize.col("resort.notes"), 'DESC'],  
        [sequelize.col("resortID"), 'ASC'],  
        [sequelize.col("resort.unitType"), 'ASC'],  
      ]
  } else if(endpoint.includes('oneListing')){
    eventCond = {
      execType: "ONE_RESORT"
    }

    order = [
      [sequelize.col("createdAt"), 'DESC'],  
    ]

  } else if(endpoint.includes('calendarUpdate')){

    // Define your search condition
    const searchCondition = search !== '' ? { [Op.substring]: search } : { [Op.not]: null };
    
    // Construct the event condition
    eventCond = {
        execType: "MANUAL_UPDATE",
        [Op.or]: [
            { '$execution.execStatus$': searchCondition },
            { '$execution.datetoUpdate$': searchCondition },
            { '$resort.resortID$': searchCondition },
            { '$resort.resortName$': searchCondition },
            { '$resort.listingName$': searchCondition },
            { '$resort.unitType$': searchCondition }
        ]
    };
    

    order = [
      [sequelize.col("createdAt"), 'DESC'],  
    ]

  } else if(endpoint.includes('events')){
    eventCond = {
      [Op.or]: [
          {'$execution.execStatus$' : { [Op.substring]: search }},
          {'$execution.monthstoScrape$' : { [Op.substring]: search }},
          {'$execution.createdAt$' : { [Op.substring]: search }},
          {'$execution.updatedAt$' : { [Op.substring]: search }},
          {'$resort.resortID$' : { [Op.substring]: search }},
          {'$resort.resortName$' : { [Op.substring]: search }},
          {'$resort.listingName$' : { [Op.substring]: search }},
          {'$resort.unitType$' : { [Op.substring]: search }},
      ]
    }

    order = [
      [sequelize.col("createdAt"), 'DESC'],  
    ]

  } else if(endpoint.includes('resorts')){
    order = [
      [sequelize.col("resortID"), 'DESC'], 
    ]
  
  }

  return { eventCond, order };
}


module.exports = router ;





