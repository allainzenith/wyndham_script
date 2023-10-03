const axios = require('axios')
const qs = require('qs');
const fs = require('fs');
const path = require('path');

// Wyndham Credentials
userName = "SJO111"
passWord = "zgw5qbc@xpw2JEQ@ypy"

// For database connection
database = "wyndham_script";
dbUsername = "root";
dbPassword = "asdasd";


// Guesty Application (name: 'scraper-allain-dev')
clientID = "0oablo4fh5K5m4GyN5d7"
clientSecret = "UHOTWqyCoO9TkDrEAjlhF3IjMoZ2Ib6meTAGPFJvoxkq4NYgM9OdF2kIcz6aIIE-"

// Location IQ for getting map coordinates
MAP_API_KEY = "pk.bf6f09004152aac4733ac98034c6c838";

async function returnAValidToken(clientID, clientSecret){
    let token;
    // Get the current date and time
    var currentDate = new Date();

    try {
        const tokenJsonPath = path.join(__dirname, './jsons/token.json');

        const rawData = fs.readFileSync(tokenJsonPath, 'utf8');
        const jsonData = JSON.parse(rawData);

        const expirationDate = new Date(jsonData.expires_in);

        // Compare the expiration date with the current date
        if (expirationDate <= currentDate){
            console.log('The expiration date has passed. Creating access token now..');
            try {
                const postData = {
                grant_type: 'client_credentials',
                scope: 'open-api',
                client_secret: clientSecret,
                client_id: clientID,
                };
                
                const axiosConfig = {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                };
                
                await axios.post('https://open-api.guesty.com/oauth2/token', qs.stringify(postData), axiosConfig)
                .then((response) => {
                    console.log(response.data)
                    const responseData = response.data;
                    token = responseData.access_token
                    var futureDateTime = new Date(currentDate.getTime() + (23 * 60 * 60 * 1000));
                    
                    //write json object in an existing json file
                    tokenSpecs = {
                        "token_type": "Bearer",
                        "expires_in": futureDateTime.toISOString(),
                        "access_token": token,
                        "scope": "open-api"
                    }
    
                    let jsonString = JSON.stringify(tokenSpecs, null, 2);
                    fs.writeFileSync(tokenJsonPath, jsonString);

                    return token;
                })
                .catch((error) => {
                    console.error('Error:', error);
                    return jsonData.access_token;
                });


            } catch (error) {
                console.error('Error:', error.message);
                console.error('Reason:', error.response.data);
                return jsonData.access_token;;        
            } 
        }
        else {
            console.log('The expiration date is in the future.');
            return jsonData.access_token;
        }
    } catch (error) {
        // Handle any errors that occur while reading the file
        console.error('Error:', error.message);
        return null;
    }

    

}

module.exports = {
    userName,
    passWord,
    database,
    dbUsername,
    dbPassword,
    clientID,
    clientSecret,
    MAP_API_KEY,
    returnAValidToken
};