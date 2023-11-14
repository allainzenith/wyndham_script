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