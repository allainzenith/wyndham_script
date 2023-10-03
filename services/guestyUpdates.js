////////////////////////////////////////////////////////////////////
// THIS IS AN API SERVICE THAT SENDS REQUESTS TO THE GUESTY API
////////////////////////////////////////////////////////////////////

const axios = require('axios')
const { MAP_API_KEY } = require('../config/config')

async function executeUpdates(token, address, updatedAvail, suiteType){
    
    if (token !== null){
        try {             
            const words = address.split(" "); 

            if (words.length >= 2) {
                var substringAddress = words.slice(0, 1).join(" "); 
            } else {
                var substringAddress = address;
                console.log("The address does not contain enough words.");
            }

            let listings = await retrieveListings(substringAddress, token);

            if (await listings !== null) { 

                console.log("Done retrieving listings: true");

                //filters array for a listing ID that is multi-unit or single, but not a sub unit
                let filteredResults = listings.results.filter((item) => (item.bedrooms === suiteType) && (item.type === "MTL" || item.type === "SINGLE")); 

                console.log("Printing calendar availability scraped from wyndham...")
                for (const avail of updatedAvail) {
                    console.log(avail);
                }

                if (filteredResults.length !== 0) {
                    for (const list of filteredResults){
                        console.log(list)
                    }
                }  else {
                    console.log("Resort with chosen address or suite type may not be available on Guesty.")
                    console.log("Please check if the address or its suite type (e.g., 1BR) matches a Guesty Listing.");

                    console.log("Printing listings without filter...")
                    for (const listing of listings.results) {
                        console.log(listing);
                    }
    
                }

                // performs the update for a listing ID that is multi-unit or single, but not a sub unit
                for (const listing of filteredResults) {
                    console.log(await updateAvailability(listing, updatedAvail, token, address));
                }

                return true;

            } else {
                console.log("Done retrieving listings: false");
                console.log( "'Listings' is null.")
                return false;
            }
    
        } catch (error) {
            console.error('Error:', error.message);
            return false;
        }
    }
}

async function retrieveListings(substringAddress, token){
    initial_endpoint = "https://open-api.guesty.com/v1/listings?"

    params = {
        q: substringAddress,
        active: true,
        pmsActive: true,
        listed: true,
        ignoreFlexibleBlocks: false,
        fields: "_id bedrooms title type address",
        sort: "bedrooms",
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

async function updateAvailability(listing, updatedAvail, token, address){

    arrayOfAvailability = []

    console.log("bedrooms: " + listing.bedrooms);
    console.log("address: " + listing.address.full);

    let {wynLat, wynLong} = await getLatLongAddress(address);

    guestLat = parseFloat(listing.address.lat).toFixed(3);
    guestLong = parseFloat(listing.address.lng).toFixed(3);

    console.log("wyn lat: " + wynLat);
    console.log("wyn long: " + wynLong); 

    console.log("guesty lat: " + guestLat);
    console.log("guesty long: " + guestLong); 

    if ( (wynLat === guestLat) && (wynLong === guestLong) ){
        console.log("the two coordinate sets match");

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
    }

    return "moving on to next listingID...";
}

async function getLatLongAddress(address){

    let encodedParameters = encodeURIComponent(address);

    try {
        await new Promise(resolve => setTimeout(resolve, 1000));

        let apiUrl = `https://us1.locationiq.com/v1/search?key=${MAP_API_KEY}&q=${encodedParameters}&format=json`;
        console.log(apiUrl);
        const coordinates = await axios.get(apiUrl);

        let latitude = parseFloat(coordinates.data[0].lat).toFixed(3);
        let longitude = parseFloat(coordinates.data[0].lon).toFixed(3);
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