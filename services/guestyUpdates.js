////////////////////////////////////////////////////////////////////
// THIS IS AN API SERVICE THAT SENDS REQUESTS TO THE GUESTY API
////////////////////////////////////////////////////////////////////

const axios = require('axios')
const { MAP_API_KEY } = require('../config/config')
var { clientID, clientSecret, returnAValidToken } = require("../config/config");
const sdk = require('api')('@open-api-docs/v1.0#pc5in1tloyhmv10');
const superagent = require('superagent');
const http = require("https");


// async function executeUpdates(resortFoundorCreated, token, address, updatedAvail, suiteType){
async function executeUpdates(resortFoundorCreated, address, updatedAvail, suiteType){
    
    // if (token !== null){
        var listingIDs = [], listingNames = [];
        let listingID, listingName, updateSuccess, success; 
        let updatedAllSuccessfully = 0;

        var resortJSON = await resortFoundorCreated.toJSON()
        var resortJSONlistingID = await resortJSON.listingID;
        console.log("resortJSONlistingID: " + resortJSONlistingID);
        if (resortJSONlistingID === undefined || resortJSONlistingID === null){

            console.log("There is no existing records for this listing. Searching one now..")

            try {             
                // let listings = await findListing(address, token, suiteType);
                let listings = await findListing(address, suiteType);

                if (listings.length !== 0) { 

                    console.log("Done retrieving listings: true");

                    console.log("Printing calendar availability scraped from wyndham...")
                    for (const avail of updatedAvail) {
                        console.log(avail);
                    }

                    // performs the update for a listing ID that is multi-unit or single, but not a sub unit
                    // for (const listing of listings) {
                    //     // updateSuccess = await updateAvailability(listing, updatedAvail, token);
                    //     updateSuccess = await updateAvailability(listing, updatedAvail);

                    //     listingIDs.push(listing._id);
                    //     listingNames.push(listing.title);

                    //     if (updateSuccess === false) {
                    //         updatedAllSuccessfully++;
                    //     }

                    // }

                    updateSuccess = await updateAvailability(listings, updatedAvail); 

                    for (const listing of listings) {

                        listingIDs.push(listing._id);
                        listingNames.push(listing.title);

                        if (updateSuccess === false) {
                            updatedAllSuccessfully++;
                        }

                    }

                    listingID = listingIDs.join(",");
                    listingName = listingNames.join(",");

                    success = updatedAllSuccessfully === 0;

                    return {listingID, listingName, success};


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

            var listingIDObj = resortJSONlistingID.split(","); 
            const listingJsonArray = listingIDObj.map(item => ({ _id: item.trim() })); 


            console.log("Printing calendar availability scraped from wyndham...")
            for (const avail of updatedAvail) {
                console.log(avail);
            }

            // for (const listing of listingJsonArray) {
            //     // try {
            //     //     // let listingObj = await retrieveAListing(listing._id, token)
            //     //     let listingObj = await retrieveAListing(listing._id)

            //     //     let hasDays = listingObj.calendarRules.bookingWindow.hasOwnProperty('defaultSettings') === false ||
            //     //                     (listingObj.calendarRules.bookingWindow.defaultSettings &&
            //     //                         listingObj.calendarRules.bookingWindow.defaultSettings.days !== 0)

            //     //     if (hasDays) {
            //     //         console.log("This listing calendar needs to be updated.")
            //     //         // let updatedAvailabilitySettings = await updateAvailabilitySettings(listing._id, token);
            //     //         let updatedAvailabilitySettings = await updateAvailabilitySettings(listing._id);
                        
            //     //         if (updatedAvailabilitySettings) {
            //     //             console.log("Calendar availability settings updated successfully.");
            //     //         } else {
            //     //             console.log("Calendar availability settings update failed.");
            //     //         }
            //     //     } 

            //     // } catch (error) {
            //     //     console.error("Error: " + error);
            //     // }

            //     updateSuccess = await updateAvailability(listing, updatedAvail);

            //     if (updateSuccess) {
            //         console.log("listing._id: " + listing._id);
            //         listingIDs.push(listing._id);
            //     } else {
            //         updatedAllSuccessfully++;
            //     }

            // }

            updateSuccess = await updateAvailability(listingJsonArray, updatedAvail);

            success = updateSuccess;

            return success ? "resort already updated" : null;
            
        }
    // } else {
    //     console.log("Token not found");
    //     return null;       
    // }
}

async function findListing(address, suiteType){
    let finalListings = [];
    const words = address.split(" "); 

    let len = words.length;

    let token = await returnAValidToken(clientID, clientSecret);

    while(len >= 1){
        
        var substringAddress = words.slice(0, len).join(" ");
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

                var difLong = Math.abs(wynLong - guestLong);
                var difLat = Math.abs(wynLat - guestLat);
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
            console.error("Error: "+ error);
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

        return responseData

    } catch (error) {
        // Handle errors that may occur during the request
        console.error('Error:', error.message);
        console.error('Reason:', error.response.data);
        return null;
    }

}

async function retrieveAListing(listingID){

    let token = await returnAValidToken(clientID, clientSecret);
    fields = "_id bedrooms title type address calendarRules.bookingWindow";
    const url = `https://open-api.guesty.com/v1/listings/${listingID}?fields=${fields}`;

    const headers = {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application json",
        "Accept": "application/json"
    };

    
    try {
        const response = await axios.get(url, { headers });
        console.log('GET request successful');
        return response.data;
    } catch (error) {
        console.error('GET request failed:', error.message);
        return null;
    }

}

async function updateAvailabilitySettings(listingID){

    let token = await returnAValidToken(clientID, clientSecret);

    const url = `https://open-api.guesty.com/v1/listings/${listingID}/availability-settings`;

    const headers = {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
    };

    const rawBody = JSON.stringify(
        {
            calendarRules: {
                bookingWindow: {
                    defaultSettings: {
                        days: 0
                    }
                }
            },
            defaultAvailability: "AVAILABLE",
        }
    )  

    try {
        await axios.put(url, rawBody, { headers });
        console.log('PUT request successful: ');
        return true;
    } catch (error) {
        console.error('PUT request failed:', error.message);
        return false;
    }

}

async function updateAvailability(listing, updatedAvail){

    let token = await returnAValidToken(clientID, clientSecret);

    const arrayOfAvailability = []
    let success = true;

    for (const item of updatedAvail) {
        for(const list of listing) {

            // arrayOfAvailability.push({
            //     listingId: list._id,
            //     startDate: item.start,
            //     endDate: item.end,
            //     status: item.availability
            // })

            arrayOfAvailability.push(`{"listingId": "${list._id}","startDate": "${item.start}","endDate": "${item.end}","status": "${item.availability}"}`);


            // try {
            //     await sdk.auth(`Bearer ${token}`);
            //     await sdk.putAvailabilityPricingApiCalendarListings([{listingId: list._id, startDate: item.start, endDate: item.start, status: item.availability}])
            //     .then(({ data }) => { 
            //         console.log(JSON.stringify(data, null, 2));
            //         console.log("PUT REQUEST SUCCESSFUL");
            //     })
            //     .catch((err) => {
            //         console.error(err);
            //         success = false;
            //     });
            // } catch (error) {
            //     console.error("error: ", error.message);
            //     success = false;
            // }

            // await new Promise(resolve => setTimeout(resolve, 2000));

            // let subArray = JSON.stringify(sub);
    
            // await superagent
            // .put('https://open-api.guesty.com/v1/availability-pricing/api/calendar/listings')
            // .set('accept', 'application/json')
            // .set('authorization', `Bearer ${token} `)  
            // .set('content-type', 'application/json')
            // .send(subArray)
            // .then(response => {
            //   console.log(response.body);
            // })
            // .catch(error => {
            //   console.error(error.response ? error.response.body : error.message);
            //   success = false;
            // });

        }
    }

    //===========================

    const chunkSize = 10;
    const subArrayOfAvailability = [];

    for (let i = 0; i < arrayOfAvailability.length; i += chunkSize) {
        subArrayOfAvailability.push(arrayOfAvailability.slice(i, i + chunkSize));
    }

    console.log("Subarray size: ", subArrayOfAvailability.length);

    for (const sub of subArrayOfAvailability) {

        const headers = {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
            "Accept": "application/json"
        };

        const subArray = '[' + sub.join(",") + ']';

        console.log(subArray)

        // const url = 'https://open-api.guesty.com/v1/availability-pricing/api/calendar/listings';

        // const options = {
        //     method: 'PUT',
        //     headers: {
        //         'accept': 'application/json',
        //         'authorization': 'Bearer eyJraWQiOiJaRHJMRkN6Zm1hQlFDby02ODI3U2M4ZlpPZmV3SHVxTWVNZ0J3cXVHWUhRIiwiYWxnIjoiUlMyNTYifQ.eyJ2ZXIiOjEsImp0aSI6IkFULnhuWHdWS0NJQnBZUTdWcENVVnhhdnlzeFFaa2pQWUVNRFlWSng1M0J5d2ciLCJpc3MiOiJodHRwczovL2xvZ2luLmd1ZXN0eS5jb20vb2F1dGgyL2F1czFwOHFyaDUzQ2NRVEk5NWQ3IiwiYXVkIjoiaHR0cHM6Ly9vcGVuLWFwaS5ndWVzdHkuY29tIiwiaWF0IjoxNzAwMTgwODA3LCJleHAiOjE3MDAyNjcyMDcsImNpZCI6IjBvYWJsbzRmaDVLNW00R3lONWQ3Iiwic2NwIjpbIm9wZW4tYXBpIl0sInJlcXVlc3RlciI6IkVYVEVSTkFMIiwiYWNjb3VudElkIjoiNjI0NzYxODBlOWZkYmEwMDM2NmY3ZjQyIiwic3ViIjoiMG9hYmxvNGZoNUs1bTRHeU41ZDciLCJ1c2VyUm9sZXMiOlt7InJvbGVJZCI6eyJwZXJtaXNzaW9ucyI6WyJhZG1pbiJdfX1dLCJyb2xlIjoidXNlciIsImNsaWVudFR5cGUiOiJvcGVuYXBpIiwiaWFtIjoidjMiLCJhY2NvdW50TmFtZSI6IkxpdmUgU3VpdGUiLCJuYW1lIjoic2NyYXBlci1hbGxhaW4tZGV2In0.eaUyjAFWFHWm64yOVMG7bHauEO5-Hnc30Ktfzdx_MZC-b_Rs0FRhVp7A9YB2d3vw5V-DyoSBidDsVm3yvifWpWJLf2WK8QYnXhUj_NWIOI-_gyDwBrODKvoNYpgO5aiGyuTihgFAWk95bKAzhLMD4aVq0F3Nh0ujwceByeURJdH16bnfoHcvYo9iq5DEJhBqd2rqDxRZ7vpFxdkXqjeLlhJE0uUiad3pO3FRdL6EtWZdbOxLavrBegzFYki2weI9h2PhEGIoTLiagUAouAp9jfEEkWHRIiBOWRVXy-A_de_Pt19lpgxOHh9_Yyl7-hon9ozswHBpITcvqNsmvnDHfQ',
        //         'content-type': 'application/json',
        //     }
        // };
    
        // let result = '';
        // const req = http.request(url, options, (res) => {
        //     console.log(res.statusCode);
    
        //     res.setEncoding('utf8');
        //     res.on('data', (chunk) => {
        //         result += chunk;
        //     });
    
        //     res.on('end', () => {
        //         // console.log(result);
        //         console.log("okay");
        //     });
        // });
    
        // req.on('error', (e) => {
        //     console.error(e);
        // });
    
        // req.write(subArray);
        // req.end();

        // try {
        //     await sdk.auth(`Bearer ${token}`);
        //     await sdk.putAvailabilityPricingApiCalendarListings(sub)
        //     .then(({ data }) => { 
        //         console.log(JSON.stringify(data));
        //     })
        //     .catch((err) => {
        //         console.error(err);
        //         success = false;
        //     });
        // } catch (error) {
        //     console.error("error: ", error.message);
        //     success = false;
        // }

        await new Promise(resolve => setTimeout(resolve, 2000));

        await superagent
        .put('https://open-api.guesty.com/v1/availability-pricing/api/calendar/listings')
        .set('Authorization', `Bearer ${token} `)  
        .set('Accept', 'application/json')
        .set('Content-type', 'application/json')
        .send(subArray)
        .then(response => {
          console.log(response.body);
        })
        .catch(error => {
          console.error(error.response ? error.response.body : error.message);
          success = false;
        });
    
    }


    return success;

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
    executeUpdates
}