////////////////////////////////////////////////////////////////////
// THIS IS AN API SERVICE THAT SENDS REQUESTS TO THE GUESTY API
////////////////////////////////////////////////////////////////////

const axios = require('axios')
const { MAP_API_KEY } = require('../config/config')

async function executeUpdates(resortFoundorCreated, token, address, updatedAvail, suiteType){
    
    if (token !== null){
        var listingIDs = [], listingNames = [];
        let listingID, listingName; 

        var resortJSON = await resortFoundorCreated.toJSON()
        var resortJSONlistingID = await resortJSON.listingID;
        console.log("resortJSONlistingID: " + resortJSONlistingID);
        if (resortJSONlistingID === undefined || resortJSONlistingID === null){

            console.log("There is no existing records for this listing. Searching one now..")

            try {             
                let listings = await findListing(address, token, suiteType);

                if (listings.length !== 0) { 

                    console.log("Done retrieving listings: true");

                    console.log("Printing calendar availability scraped from wyndham...")
                    for (const avail of updatedAvail) {
                        console.log(avail);
                    }

                    // performs the update for a listing ID that is multi-unit or single, but not a sub unit
                    for (const listing of listings) {
                        console.log(await updateAvailability(listing, updatedAvail, token));
                        listingIDs.push(listing._id);
                        listingNames.push(listing.title);
                    }

                    listingID = listingIDs.join(",");
                    listingName = listingNames.join(",");

                    return {listingID, listingName};


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

            for (const listing of listingJsonArray) {
                
                let listingObj = await retrieveAListing(listing._id, token)
                let bookingWindowFound = Object.keys(listingObj.calendarRules.bookingWindow).length === 0;

                if(bookingWindowFound) {
                    if((listingObj.calendarRules.bookingWindow.defaultSettings.days) !== 0) {
                        console.log("This listing calendar needs to be updated.")
                        let updatedAvailabilitySettings = await updateAvailabilitySettings(listing._id, token);

                        if (updatedAvailabilitySettings) {
                            console.log("Calendar availability settings updated successfully.");
                            console.log(await updateAvailability(listing, updatedAvail, token));
                            console.log("listing._id: " + listing._id);
                            listingIDs.push(listing._id);
                        } else {
                            console.log("Calendar availability settings update failed.");
                        }
                    }
                }

            }


            return "okay";
            
        }
    } else {
        console.log("Token not found");
        return null;       
    }
}

async function findListing(address, token, suiteType){
    let finalListings = [];
    const words = address.split(" "); 

    let len = words.length;

    while(len >= 1){
        await new Promise(resolve => setTimeout(resolve, 1000));
        
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

                    if((listing.calendarRules.bookingWindow.defaultSettings.days) !== 0) {
                        console.log("This listing calendar needs to be updated.")
                        let updatedAvailabilitySettings = updateAvailabilitySettings(listing._id, token);

                        if (updatedAvailabilitySettings) {
                            console.log("Calendar availability settings updated successfully.");
                        } else {
                            console.log("Calendar availability settings update failed.");
                        }
                    }
            
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


    return finalListings;

}

async function retrieveListings(substringAddress, token){
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

async function retrieveAListing(listingID, token){
    fields = "_id bedrooms title type address calendarRules.bookingWindow.defaultSettings";
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
        console.error('GET request failed:', error);
        return null;
    }

}

async function updateAvailabilitySettings(listingID, token){

    const url = `https://open-api.guesty.com/v1/listings/${listingID}/availability-settings`;

    const headers = {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
    };

    const rawBody = JSON.stringify({
    calendarRules: {
        defaultAvailability: "AVAILABLE",
        bookingWindow: {
            defaultSettings: {
                days: 0
            }
        }
    }
    })  

    try {
        await axios.put(url, rawBody, { headers });
        console.log('PUT request successful');
        return true;
    } catch (error) {
        console.error('PUT request failed:', error);
        return false;
    }

}

async function updateAvailability(listing, updatedAvail, token){

    arrayOfAvailability = []

    for (const item of updatedAvail) {

        data = {
            listingId: listing._id,
            startDate: item.start,
            endDate: item.end,
            status: item.availability,

        }

        arrayOfAvailability.push(data);
    }


    const url = 'https://open-api.guesty.com/v1/availability-pricing/api/calendar/listings'; 

    const headers = {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
    };


    await axios.put(url, arrayOfAvailability, { headers })
    .then(response => {
        console.log('PUT request successful');
        console.log('Response data:', response.data);
    })
    .catch(error => {
        console.error('PUT request failed:', error);
    });

    return "moving on to next listingID...";
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