// async function loginVerified() {
  
//     let checkToBegin = true;
  
//     while (checkToBegin) {
//       await new Promise(resolve => setTimeout(resolve, 5000));
//       try {
//         sharedData.page;
//         sharedData.pageForAddress;
//         checkToBegin = false;
//       } catch (error) {
//         console.log("Error: ", error.message);
//       }
//     }
  
//     try {
//       const page = sharedData.page;
//       const pageForAddress = sharedData.pageForAddress;
  
  
//       await Promise.all([
//         page.waitForNavigation(), 
//         page.bringToFront(),
//         page.goto("https://clubwyndham.wyndhamdestinations.com/us/en/login")
//       ]);
  
//       if (await page.url() !== "https://clubwyndham.wyndhamdestinations.com/us/en/login"){
//         return "MAINTENANCE";
  
//       } else {
//         await Promise.all([
//           pageForAddress.waitForNavigation(), 
//           pageForAddress.bringToFront(),
//           pageForAddress.goto(
//             `https://clubwyndham.wyndhamdestinations.com/us/en/resorts/resort-search-results`
//           )
//         ]);
  
  
//         let addressSelectorFound = 0;
  
//         while (addressSelectorFound < 5) {
//           try {
//             await pageForAddress.waitForSelector(`.resort-card`, {
//               timeout: 10000,
//             });
//             await pageForAddress.waitForSelector(`.resort-card__address`, {
//               timeout: 10000,
//             });       
//             console.log("resorts fully loaded.");
//             addressSelectorFound = 5;
//           } catch (error) {
//             addressSelectorFound++;
//             console.log("Timed out. Reloading the page.");
//             await pageForAddress.reload();
//           }
//         }
  
//         await page.bringToFront();
//         console.log("I'M ON THE LOGIN PAGE");
  
//         let loginSelector = await page.$(`.button-primary[value*="Login"]`);
//         await loginSelector.scrollIntoView();
  
//         await checkOverlay('.onetrust-close-btn-handler[aria-label*="Close"]');
  
//         // Fill out the login form
//         await page.type("#okta-signin-username", userName);
//         await page.type("#okta-signin-password", passWord);
  
//         // Submit the form
//         await page.waitForTimeout(2000);
  
  
//         console.log("about to submit..");
        
//         try {
//           await page.waitForTimeout(5000);
//           await page.waitForSelector(`.button-primary[value*="Login"]`);
//           await page.click(`.button-primary[value*="Login"]`);
//           console.log("form submitted")
//         } catch (error) {
//           console.log("Can't submit");
//           console.log("Error message: ", error.message);
//         }
  
//         // Click the <a> tag with a specific data-se attribute value
//         const dataSeValue = "sms-send-code";
//         const selector = `a[data-se="${dataSeValue}"]`;
  
//         try {
//           await page.waitForSelector(selector);
//           console.log("send-code button found");
//           await page.click(selector);
//           console.log("We need OTP verification!");
  
//           return false;
  
//         } catch (error) {
//           await page.waitForTimeout(5000);
//           if(await page.url() === 'https://clubwyndham.wyndhamdestinations.com/us/en/owner/account') {
//             console.log("No need for OTP verification");
//             console.log("Logged in successfullyyyy!!");
//             await page.waitForSelector(
//               `.resortAvailabilityWidgetV3-title-text-color-default`,
//               { timeout: 120000 }
//             );
//             return false;
//           } else {
//             console.log("Error: ", error.message);
//           }
//           return true;
//         }
//       }
    
//     } catch (error) {
//       console.error("Error logging in using the login credentials");
//       console.error("Error:", error.message);
//       return false;
//     }
      
//   }

///////////////////////////////////////////////////
// let currentMonth = currentDate.toLocaleDateString(undefined, {
//     month: "2-digit",
//   });

//   let initialDate =
//     monthNow === 0
//       ? currentDate.toLocaleDateString(undefined, { day: "2-digit" })
//       : "01";

//   let currentYear = currentDate.getFullYear();

//   let secondResponseStart =
//     parseInt(currentMonth, 10) < 8
//       ? parseInt(currentMonth, 10) % 2 !== 0
//         ? "18"
//         : "17"
//       : (parseInt(currentMonth, 10) + 1) % 2 !== 0
//       ? "18"
//       : "17";

// let currentMonth = currentDate.toLocaleDateString(undefined, {
//     month: "2-digit",
//   });

//   let initialDate = monthNow === 0 ? currentDate.toLocaleDateString( undefined, { day: "2-digit"} ) : '01';

//   let currentYear = currentDate.getFullYear();

//   let secondResponseStart = parseInt(currentMonth, 10) < 8 
//     ? (parseInt(currentMonth, 10) % 2 != 0) ? '18' : '17' 
//     : (parseInt(currentMonth, 10) + 1) % 2 != 0 ? '18' : '17';

//   const responses = await Promise.race([
//     (async () => {
//       const responsePromises = [];
  
//       // Wait for both responses
//       const waitForResponse1 = page.waitForResponse(response => response.url().includes('https://api.wvc.wyndhamdestinations.com/resort-operations/v3/resorts/calendar/availability'));
//       responsePromises.push(waitForResponse1.then(response => response.text().then(text => isCorrectResponse(text, `${currentYear}-${currentMonth}-${initialDate}`))));
  
//       const waitForResponse2 = page.waitForResponse(response => response.url().includes('https://api.wvc.wyndhamdestinations.com/resort-operations/v3/resorts/calendar/availability'));
//       responsePromises.push(waitForResponse2.then(response => response.text().then(text => isCorrectResponse(text, `${currentYear}-${currentMonth}-${secondResponseStart}`))));
  
//       // Wait for both promises to resolve
//       await Promise.all(responsePromises);

//       await page.evaluate(() => {
//         // Use the following code to clear network logs
//         console.clear();
//         performance.clearResourceTimings();
//       });

//       return Promise.all([waitForResponse1, waitForResponse2]);
//     })(),
//     page.waitForTimeout(20000),
//   ]);
  

//   // Filter out undefined values in the 'responses' array 
//   const filteredResponses = (responses !== undefined) ? responses.filter(response => response) : [];

//   if (filteredResponses.length > 0) {
//     const responseTexts = await Promise.all(filteredResponses.map(response => response.text()));
//     let parsedResponse = [];

//     if (filteredResponses.length === 1) {
//       // Handle the case with one response
//       try {
//         parsedResponse = JSON.parse(responseTexts[0]).calendarDays;

//         // console.log('Response with one item:', JSON.stringify(parsedResponse, null, 2));
//       } catch (error) {
//         console.error('Error parsing JSON:', error);
//       }
//     } else if (filteredResponses.length === 2) {
//       // Handle the case with two responses
//       try {
//         const parsedResponse1 = JSON.parse(responseTexts[0]);
//         const parsedResponse2 = JSON.parse(responseTexts[1]);

//         // Merge or process the responses as needed
//         // For example, merge calendarDays arrays
//         parsedResponse = parsedResponse1.calendarDays.concat(parsedResponse2.calendarDays);

//         // Output the merged response
//         // console.log('Merged response:', JSON.stringify(parsedResponse, null, 2));
//       } catch (error) {
//         console.error('Error parsing JSON:', error);
//       }
//     }