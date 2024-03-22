////////////////////////////////////////////////////////////////////
// THIS IS AN API SERVICE THAT SENDS REQUESTS TO THE GUESTY API
////////////////////////////////////////////////////////////////////

const axios = require('axios')
const { MAP_API_KEY } = require('../config/config')
const { getCurrentAndEndDate } = require("./scraper");
const { addMonths, addDays, format } = require("date-fns");
let { clientID, clientSecret, returnAValidToken } = require("../config/config");
const { createAnEvent, updateEventStatus } = require('../sequelizer/controller/event.controller');
const { findRecords } = require('../sequelizer/controller/controller');


async function updateSingleListing(resort, startDate, endDate) {

    const listingID = resort.listingID;
    const resortRefNum = resort.resortRefNum;

    let start = new Date(startDate);
    let recordArr = [];
    const end = new Date(endDate);

    //add to database
    while(start <= end) {
        const record = await createAnEvent(resortRefNum, format(start, 'yyyy-MM-dd'));
        recordArr.push(record);
        start = addDays(start, 1)
    }

    const url = `https://open-api.guesty.com/v1/availability-pricing/api/calendar/listings/${listingID}`;

    const token = await returnAValidToken(clientID, clientSecret);
    const headers = {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
    };

    const payload = {
        startDate: startDate,
        endDate: endDate,
        status: "available"
    }

    try {   
        await axios.put(url, payload, { headers });
        console.log("Calendar single update successful.");

        for(const record of recordArr) {
            await updateEventStatus(record, "DONE");
        }

        return true;

    } catch (error) {
        // Handle errors that may occur during the request
        console.error('Error:', error.message);
        console.error('Reason:', error.response.data);
        return null;
    }

}

// async function executeUpdates(resortFoundorCreated, token, address, updatedAvail, suiteType){
async function executeUpdates(resortFoundorCreated, address, updatedAvail, suiteType, months, page){

    let listingIDs = [], listingNames = [];
    let listingID, listingName, updateSuccess; 

    // var resortJSON = await resortFoundorCreated.toJSON()
    let resortJSONlistingID = await resortFoundorCreated.listingID;
    console.log("resortJSONlistingID: " + resortJSONlistingID);
    if (resortJSONlistingID === undefined || resortJSONlistingID === null){

        console.log("There is no existing records for this listing. Searching one now..")

        try {             
            let listings = await findListing(address, suiteType);

            if (listings.length !== 0) { 

                console.log("Done retrieving listings: true");

                console.log("Printing calendar availability scraped from wyndham...")
                for (const avail of updatedAvail) {
                    console.log(avail);
                }

                updateSuccess = await updateAvailability(listings, updatedAvail, months, page); 

                for (const listing of listings) {

                    listingIDs.push(listing._id);
                    listingNames.push(listing.title);


                }

                listingID = listingIDs.join(",");
                listingName = listingNames.join(",");

                return {listingID, listingName, updateSuccess};


            } else {
                console.log("Resort with chosen address or suite type may not be available on Guesty.")
                console.log("Please check if the address or its suite type (e.g., 1BR) matches a Guesty Listing.");
                console.log( "'Listings' is empty.")
                return null;
            }
    
        } catch (error) {
            console.error('Error:', error.message);
            return null;
        }

    } else {
        console.log("Listing found!");

        let listingIDObj = resortJSONlistingID.split(","); 
        const listingJsonArray = listingIDObj.map(item => ({ _id: item.trim() })); 


        console.log("Printing calendar availability scraped from wyndham...")
        for (const avail of updatedAvail) {
            console.log(avail);
        }


        for (const listing of listingJsonArray) {
            try {
                console.log("Listing id: ", listing._id);
                let listingObj = await retrieveAListing(listing._id)

                let hasDays = listingObj.calendarRules.bookingWindow.hasOwnProperty('defaultSettings') === false ||
                                (listingObj.calendarRules.bookingWindow.defaultSettings &&
                                    listingObj.calendarRules.bookingWindow.defaultSettings.days !== 0)

                if (hasDays) {
                    console.log("This listing calendar needs to be updated.")
                    let updatedAvailabilitySettings = await updateAvailabilitySettings(listing._id);
                    
                    if (updatedAvailabilitySettings) {
                        console.log("Calendar availability settings updated successfully.");
                    } else {
                        console.log("Calendar availability settings update failed.");
                    }
                } else {
                    console.log("Availability settings does not need to be updated");
                }

            } catch (error) {
                console.error("Error: " + error);
            }

        }

        updateSuccess = await updateAvailability(listingJsonArray, updatedAvail, months, page);

        return updateSuccess ? "resort already updated" : null;
        
    }

}

async function findListing(address, suiteType){


    let finalListings = [];
    const words = address.split(" "); 

    let len = words.length;

    let token = await returnAValidToken(clientID, clientSecret);

    while(len >= 1){
        
        let substringAddress = words.slice(0, len).join(" ");
        console.log("substringAddress: " + substringAddress);
        let queListings = await retrieveListings(substringAddress, token);

        let specialSuiteString = suiteType === 5 ? 'Presidential' 
        : suiteType === 6 ? 'Hotel' 
        : suiteType === 0 ? 'Studio' : '';

        for (const listing of queListings.results){

            let firstCondition = specialSuiteString === '' 
                ? (listing.bedrooms === suiteType) 
                : ((listing.title).includes(specialSuiteString))

            if (firstCondition && (listing.type === "MTL" || listing.type === "SINGLE")){
                let {wynLat, wynLong} = await getLatLongAddress(address);
                guestLat = Math.abs(parseFloat(listing.address.lat).toFixed(2));
                guestLong = Math.abs(parseFloat(listing.address.lng).toFixed(2));
            
                console.log("wyn lat: " + wynLat);
                console.log("wyn long: " + wynLong); 
            
                console.log("guesty lat: " + guestLat);
                console.log("guesty long: " + guestLong); 

                let difLong = Math.abs(wynLong - guestLong);
                let difLat = Math.abs(wynLat - guestLat);
                console.log("difference between longitudes: " + difLat);
                console.log("difference between latitudes: " + difLong); 
                
                if ( (wynLat === guestLat || difLat <= .10) && (wynLong === guestLong || difLong <= .10) ){
                    console.log("the two coordinate sets match");          
                    finalListings.push(listing)
                }

            }        
        }
        len--;
    }

    const uniqueIds = new Set();

    finalListings = finalListings.filter(item => {
        if (!uniqueIds.has(item._id)) {
            uniqueIds.add(item._id); 
            console.log(`item included: ${JSON.stringify(item, null, 2)}`);
            return true; 
        }
        return false; 
    });

    for (const listing of finalListings) {
        try {
            let hasDays = listing.calendarRules.bookingWindow.hasOwnProperty('defaultSettings') === false ||
                        (listing.calendarRules.bookingWindow.defaultSettings &&
                            listing.calendarRules.bookingWindow.defaultSettings.days !== 0)

            if(hasDays) {
                console.log("This listing calendar needs to be updated.")
                let updatedAvailabilitySettings = updateAvailabilitySettings(listing._id, token);

                if (updatedAvailabilitySettings) {
                    console.log("Calendar availability settings updated successfully.");
                } else {
                    console.log("Calendar availability settings update failed.");
                }
            }
        } catch (error) {
            console.error("Error evaluating availability settings: "+ error);
        }
    }


    return finalListings;

}

async function retrieveListings(substringAddress){
    
    let token = await returnAValidToken(clientID, clientSecret);
    initial_endpoint = "https://open-api.guesty.com/v1/listings?"

    params = {
        q: substringAddress,
        fields: "_id bedrooms title type address calendarRules.bookingWindow.defaultSettings",
        sort: "type",
        limit: 100,
        skip: 0
    };

    reqHeaders = {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json"
    }

    const requestArgs = Object.keys(params)
    .map(key => `${key}=${params[key]}`)
    .join('&');

    try {
        const apiUrl = `${initial_endpoint}${requestArgs}`;
        const response = await axios.get(apiUrl, {headers : reqHeaders});
        const responseData = response.data;

        return responseData;

    } catch (error) {
        // Handle errors that may occur during the request
        console.error('Error:', error.message);
        console.error('Reason:', error.response.data);
        return null;
    }

}

async function retrieveAListing(listingID){

    let token = await returnAValidToken(clientID, clientSecret);
    let fields = "_id bedrooms title type address calendarRules.bookingWindow";
    const url = `https://open-api.guesty.com/v1/listings/${listingID}?fields=${fields}`;

    const headers = {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
    };


    try {
        const response = await axios.get(url, {headers});
        const responseData = response.data;

        console.log("Listing retrieved successfully!");
        console.log(JSON.stringify(responseData.calendarRules, null, 2));

        return responseData;

    } catch (error) {
        // Handle errors that may occur during the request
        console.error('Error:', error.message);
        console.error(error)
        console.error('Reason:', error.response.data);
        return null;
    }
}

async function updateAvailabilitySettings(listingID){

    let token = await returnAValidToken(clientID, clientSecret);

    const url = `https://open-api.guesty.com/v1/listings/${listingID}/availability-settings`;
  
    const payload = { "calendarRules": {
        "bookingWindow": { "defaultSettings": { "days": 0 } },
        "defaultAvailability": "AVAILABLE"
    } }
    
    const headers = {
        'Accept': 'application/json',
        'Content-type': 'application/json',
        'Authorization': `Bearer ${token}`
    }
    try {
  
        const availSettingsUpdated = await axios.put(url, payload, { headers })
        .then(response => {
            console.log("Availability settings PUT request successful.");
            return true;
        })
        .catch(error => {
            console.error(error.message);
            return false;
        }) 
        
        return availSettingsUpdated;

    } catch (error) {
        // Handle errors that may occur during the request
        console.error('Error:', error.message);
        console.error('Reason:', error.response.data);
        return false;
    }
}

async function updateAvailability(listing, updatedAvail, months, page){

    try {
        let token = await returnAValidToken(clientID, clientSecret);

        const arrayOfAvailability = []
        let success = 0;

        const url = 'https://open-api.guesty.com/v1/availability-pricing/api/calendar/listings';

        const headers = {
            'Accept': 'application/json',
            'Content-type': 'application/json',
            'Authorization': `Bearer ${token}`
        }

        for (const item of updatedAvail) {
            for(const list of listing) {
                let cta = item.availability === "unavailable" ? true : false;
                arrayOfAvailability.push({
                    listingId: list._id,
                    startDate: item.start,
                    endDate: item.end,
                    status: item.availability, 
                    cta: cta, 
                    ctd: cta
                });

            }
        }

        //===========================

        const chunkSize = 10;
        const subArrayOfAvailability = [];

        for (let i = 0; i < arrayOfAvailability.length; i += chunkSize) {
            subArrayOfAvailability.push(arrayOfAvailability.slice(i, i + chunkSize));
        }

        console.log("Subarray size: ", subArrayOfAvailability.length);

        let requestsSent = 0;

        const updatePromises = subArrayOfAvailability.map(async (sub) => {
            try {
                await axios.put(url, sub, { headers })
                    .then(async (response) => {
                        console.log("Request successful");
                    })
                    .catch(error => {
                        console.error(error.message);
                        console.log("Request failed");
                    });
        
                requestsSent++;
        
                if (requestsSent >= 10) {
                    console.log("Ten or more requests sent. Waiting for a second.");
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
        
                return true;
            } catch (err) {
                console.error(err.message);
                return false;
            }
        });
        
        const interval = setInterval(async () => {
            try {
                console.log("Reloading page..");
                await Promise.all([
                    page.waitForNavigation({ waitUntil: 'load' }),
                    page.reload()
                ]);
            } catch (error) {
                console.error("Error while reloading page:", error);
            }
        }, 60 * 1000);
        
        await Promise.all(updatePromises);
        
        clearInterval(interval);
        

        console.log("individual checking now..");


        let indiUpdatedAvail = [];

        for (const item of updatedAvail) {
            let start = new Date(item.start);
            let end = new Date(item.end);
            
            while (start <= end) {
                indiUpdatedAvail.push({
                    dateUpdatedAvail: start.toLocaleDateString("en-CA"),
                    statusUpdatedAvail: item.availability
                })
                start = addDays(start, 1);
            }
        }

        for (const list of listing) {
            success = await finalizeAccuracy(months, list._id, indiUpdatedAvail, page);
        } 

        if (success === 0) {
            console.log("Calendar updated successfully!");  
        } else {
            console.log("Previous requests failed. Execution status set to UPDATE_FAILED.");
        }

        console.log(success);
        return success === 0;

    } catch (error) {
        console.error("Error updating availability: ", error.message);
        return false;
    }

}

async function finalizeAccuracy(months, listingID, indiUpdatedAvail, page) {

    try {
        let success = 0;
        const { currentDate, EndDate } = getCurrentAndEndDate(months);
        let startDate = currentDate.toLocaleDateString("en-CA");
        let endDate = EndDate.toLocaleDateString("en-CA");
        
        let data = await getCalendarAvailability(startDate, endDate, listingID);

        if (data !== null) {
            let dateAvailability = data.data.days;
            let retrievedAvailability = [];

            for (const item of dateAvailability) {
                let advanceNotice = item.blocks.hasOwnProperty('an') ? item.blocks.an : false;

                const isAvailable = (typeof item.allotment === 'number' && !Number.isNaN(item.allotment))? item.allotment > 0 : item.status === 'available';

                const status = isAvailable ? "available" : "unavailable";

                if (advanceNotice) {
                    console.log("This date is in an advance notice block type. It cannot be updated");
                    console.log("===================================================================");
                    console.log("Date: ");
                    console.log(item.date);
                    console.log(status);
                    console.log(item.blocks.an);
                    console.log("===================================================================");
                }

                retrievedAvailability.push({
                    listingId: item.listingId, 
                    date: item.date,
                    status: status,
                    an: advanceNotice
                })
            }
            
            const finalAvailability = indiUpdatedAvail.map((obj, index) => ({ ...obj, ...retrievedAvailability[index] }));

            let requestsSent = 0;

            
            const resort = await findRecords({ listingID : listingID }, "resorts", null, null, null);

            const resortRefNum = resort[0].resortRefNum;
            const condJson = { resortRefNum: resortRefNum, execType : "MANUAL_UPDATE" };
            const cancelledReservationDates = await findRecords(condJson, "execution", null, null, null);

            let dateManuallyUpdated;
            let status;

            for (const item of finalAvailability) {
                const currentDate = item.dateUpdatedAvail;
 
                dateManuallyUpdated = cancelledReservationDates.find(item => item.datetoUpdate === currentDate);

                if(dateManuallyUpdated || (item.dateUpdatedAvail === item.date && item.statusUpdatedAvail !== item.status && item.an === false)) {
                    // if date is a cancelled reservation before, do not update its status
                    if (dateManuallyUpdated) {

                        console.log("This date has had a cancelled reservation, thus, cannot be updated to unavailable.");
                        console.log("**********************************************************************************");
                        console.log("Date: ");
                        console.log(item.date);
                        console.log("**********************************************************************************");

                        status = "available";

                    } else {
                        console.log("statuses don't match");
                        console.log(item);
                        status = item.statusUpdatedAvail;
                        
                    }

                    
                    try {
                        const blockObject = {
                            startDate: item.dateUpdatedAvail,
                            endDate: item.dateUpdatedAvail,
                            status: status
                        };

                        let updateCalendarSuccess = await updateCalendarIndividually(blockObject, item.listingId);

                        if (updateCalendarSuccess === false) { 
                            console.log("One of the individual updates did not execute successfully.")
                            success++; 
                        };

                    } catch (error) {
                        console.error('PUT request failed for individual update:', error.message);
                        success++;
                    }

                    requestsSent++;

                    if (requestsSent >=10) {
                        //page reload
                        requestsSent = 0;
                        await Promise.all([
                            page.waitForNavigation({ waitUntil: 'load' }),
                            page.reload()
                        ])

                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
  
                } 
            }
        } else {
            success = 1;
        }

        console.log("finalize accuracy: ", success);
        return success;
    } catch (error) {
        console.error("Error finalizing accuracy", error.message);
        return 1;
    } 

}

async function getCalendarAvailability(startDate, endDate, listingID) {

    try {
        return new Promise(async(resolve, reject) => {
            let token = await returnAValidToken(clientID, clientSecret);

            const url = `https://open-api.guesty.com/v1/availability-pricing/api/calendar/listings/${listingID}?startDate=${startDate}&endDate=${endDate}&includeAllotment=${true}`

            const headers = {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
                "Accept": "application/json"
            };
        
        
            try {
                const response = await axios.get(url, { headers });
                const responseData = response.data;
        
                console.log('Request to retrieve calendar successful')
                let availCalendar = responseData;
                resolve(availCalendar);
        
            } catch (error) {
                // Handle errors that may occur during the request
                console.error('Error:', error.message);
                console.error('Reason:', error.response.data);
                reject(null);
            }

        });
    } catch (error) {
        console.log("Error getting calendar availability: ", error.message);
        return null;
    }

}

async function updateCalendarIndividually(blockObject, listingId) {

    try {
        return new Promise(async(resolve, reject) => {
            let token = await returnAValidToken(clientID, clientSecret);

            const url = `https://open-api.guesty.com/v1/availability-pricing/api/calendar/listings/${listingId}`


            const headers = {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
                "Accept": "application/json"
            };

            await axios.put(url, blockObject, { headers })
            .then(response => {
                console.log("Final Request Successful");
                resolve(true);
            })
            .catch(error => {
                console.error(error);
                reject(false);
            }) 

        });

    } catch (error) {
        console.log("Error updating calendar individually: ", error.message);
        return null;
    }

}


async function getLatLongAddress(address){

    let encodedParameters = encodeURIComponent(address);

    try {
        await new Promise(resolve => setTimeout(resolve, 1000));

        let apiUrl = `https://us1.locationiq.com/v1/search?key=${MAP_API_KEY}&q=${encodedParameters}&format=json`;
        const coordinates = await axios.get(apiUrl);

        let latitude = Math.abs(parseFloat(coordinates.data[0].lat).toFixed(2));
        let longitude = Math.abs(parseFloat(coordinates.data[0].lon).toFixed(2));
        return {wynLat: latitude, wynLong: longitude}; 

    } catch (error) {
        // Handle errors that may occur during the request
        console.error('Error:', error.message);
        console.error('Reason:', error.response.data);
        return null;
    } 

}

module.exports = {
    executeUpdates,
    updateSingleListing
}