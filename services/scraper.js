////////////////////////////////////////////////////////////////////
// THIS IS A SERVICE FOR SCRAPING DATA FROM THE WYNDHAM WEBSITE
////////////////////////////////////////////////////////////////////

const readline = require('readline');
const fs = require('fs');
const path = require('path');
const { addMonths, addDays } = require('date-fns');
const { userName, passWord} = require('../config/config')
const { globals, sharedData } =  require('../config/puppeteerOptions'); 


async function launchPuppeteer(){
  await globals();
}
async function executeScraper(resortID, suiteType, months){
  await globals();
  const browser = sharedData.browser;
  try {
    doneLogin = await loginSecondTime();
    console.log("Done login: " + doneLogin);
    
    sElement = (doneLogin) ? await selectElements(resortID, suiteType) : null;
    console.log('Selected Option Text:', sElement);
    doneSelecting = (sElement !== null);
    console.log("Done selecting: " + doneSelecting);

    address = (doneSelecting) ? await getResortAddress(resortID, sElement): null;
    doneGettingAddress = (address !== null);
    console.log("Done getting address: " + doneGettingAddress);
    console.log("address: " + address);

    updatedAvail = (doneGettingAddress) ? await checkAvailability(months): null;
    doneScraping = (updatedAvail !== null);
    console.log("Done scraping: " + doneScraping);

    if (doneLogin && doneSelecting && doneScraping && doneGettingAddress){
      console.log("Done scraping. Calendar updating...")
      return { address, updatedAvail, sElement };
    } else {
      console.log("One or more of the scraping processes did not execute successfully. Please try again.")
      return null;
    }

  } catch (error) {
    console.error('Error:', error.message);
    return null;
  } finally {
    await browser.close();
  }
}

async function login () {
  try {    
    // Navigate to the login page
    await globals();
    const page = sharedData.page;
    await page.goto('https://clubwyndham.wyndhamdestinations.com/us/en/login');

    console.log("I'M ON THE LOGIN PAGE")

    if (process.env.NODE_ENV === 'production' ){
      console.log("THIS IS THE PRODUCTION ENVIRONMENTTT")
    }

    // Fill out the login form
    await page.type('#okta-signin-username', userName);
    await page.type('#okta-signin-password', passWord);

    // Submit the form
    await page.click('input[type="submit"]');

    // Click the <a> tag with a specific data-se attribute value
    const dataSeValue = 'sms-send-code'; 
    const selector = `a[data-se="${dataSeValue}"]`;

    try {
      await page.waitForTimeout(5000);
      await page.waitForSelector(selector);
      await page.click(selector);
      console.log("We need OTP verification!")
      return "needs OTP";
    } catch (error) {
      console.log("No need for OTP verification")
      console.log('Logged in successfullyyyy!!');
      return true;
    } 

  } catch ( error ) {
    console.error('Error logging in using the login credentials');
    console.error('Error:', error.message);
    return false;   
  } 
}

async function sendOTP(verOTP) {
  // const browser = sharedData.browser;
  const page = sharedData.page;
  try {
    await page.type('#input60', verOTP)
    await page.click('#input69');
    await page.click('input[type="submit"]');

    // try {
    //   await page.waitForTimeout(3000);
    //   await page.$('#error-fragment');
    //   console.log("The token code is incorrect");
    //   return false;
    // } catch (error) {
      console.log('Logged in successfullyyyy!!');
      return true;
    // }

  } catch ( error ) {
    console.error('Error:', error.message);
    return false;  
  } finally {
    await page.close();
  }
}

async function loginSecondTime () {
  try {    
    // Navigate to the login page
    const page = sharedData.page;
    await page.goto('https://clubwyndham.wyndhamdestinations.com/us/en/login');

    console.log("I'M ON THE LOGIN PAGE")

    if (process.env.NODE_ENV === 'production' ){
      console.log("THIS IS THE PRODUCTION ENVIRONMENTTT")
    }

    // Fill out the login form
    await page.type('#okta-signin-username', userName);
    await page.type('#okta-signin-password', passWord);

    // Submit the form
    await page.click('input[type="submit"]');

    // Click the <a> tag with a specific data-se attribute value
    const dataSeValue = 'sms-send-code'; 
    const selector = `a[data-se="${dataSeValue}"]`;

    try {
      await page.waitForTimeout(5000);
      await page.waitForSelector(selector);
      await page.click(selector);
      console.log("We need OTP verification!")
      return "needs OTP";
    } catch (error) {
      console.log("No need for OTP verification")
      console.log('Logged in successfullyyyy!!');
      return true;
    } 

  } catch ( error ) {
    console.error('Error logging in using the login credentials');
    console.error('Error:', error.message);
    return false;   
  } 
}


async function selectElements(resortID, suiteType){
  const page = sharedData.page;

  try {
    var calendarUrl = `https://clubwyndham.wyndhamdestinations.com/us/en/owner/resort-monthly-calendar?productId=${resortID}`;

    await page.goto(calendarUrl);   

    await page.waitForTimeout(5000);
    console.log("I'M ON THE CALENDAR PAGE")

    const resortSelector = "#ResortSelect";
    // await page.waitForSelector(resortSelector);

    let selectedOptionText = await page.evaluate((selector) => {
      const select = document.querySelector(selector);
      const selectedOption = select.options[select.selectedIndex];
      return selectedOption.text;
    }, resortSelector);

    const suiteSelector = '#suiteType';
    await page.waitForSelector(suiteSelector);

    await page.waitForFunction(
      (selector) => {
        const select = document.querySelector(selector);
        const options = select ? select.options : [];
        return options.length > 1;
      },
      { timeout: 10000 }, 
      suiteSelector
    );

    const optionExists = await page.evaluate((suiteSelector, suiteType) => {
      const select = document.querySelector(`${suiteSelector}`);
      if (select) {
        const options = Array.from(select.options);

        return options.some(option => option.value === suiteType);
      }
      return false;
    }, suiteSelector, suiteType);

    if (optionExists) {
      await page.select(suiteSelector, suiteType);

      const purchaseSelector = '#purchaseType';
      await page.select(purchaseSelector, "Developer");

      return selectedOptionText;
    } else {
      console.log(`The option with value "${suiteType}" does not exist in the select element.`);
      return null;
    }

    


  } catch ( error ) {
    console.error('Error:', error.message);  
    await page.waitForTimeout(60000);
    return null;

  } finally {
    await page.waitForTimeout(2000);

  }
}

async function checkAvailability(months){

  const page = sharedData.page;
  try{
    var { currentDate, EndDate } = getCurrentAndEndDate(months);
    var dates = [];
    var available;

    while (currentDate <= EndDate) {
      try {
        var month = currentDate.toLocaleDateString(undefined, { month: 'long' });
        var day = currentDate.toLocaleDateString(undefined, { day: '2-digit' });
        
        // Construct the CSS selector based on day and month
        var dayClass = `.react-datepicker__day--0${day}[aria-label*="${month}"]`;
        
        // Use page.$() to find the element by CSS selector
        var dateElement = await page.$(dayClass);

        if (dateElement) {
          var ariaDisabledValue = await dateElement.evaluate(element => {
            // Use the element.getAttribute() method to get the value of aria-disabled
            return element.getAttribute('aria-disabled');
          });

          available = (ariaDisabledValue === "true") ? "unavailable" : "available";
          dates.push({ date: currentDate.toLocaleDateString('en-CA'), availability: available})
        }

        currentDate = addDays(currentDate, 1);

        if(month != currentDate.toLocaleDateString(undefined, { month: 'long' })){
          var nextClass = `.react-datepicker__navigation--next[aria-label="Next Month"]`;
          var nextButton = await page.$(nextClass);
          if (nextButton) {
            await nextButton.click();
            await page.waitForTimeout(2000);
          } else {
            console.log("did not find the button")
          }
        } 


      } catch (error) {
        console.error('Error:', error.message);
        console.log('Day class not found');
      }
      
    }

    index = 0;
    var currentItem;
    var nextItem;
    var updatedAvail = []; 
    var start = null;
    while(index <= (dates.length-2)){
      currentItem = dates[index];
      nextItem = dates[index+1];

      if( start === null){
        start = currentItem.date;
      }

      if (currentItem.availability === "available" && nextItem.availability === "unavailable"){
          updatedAvail.push({ 
            start: start, 
            end: nextItem.date, 
            availability: "available"
          })
          index = index < dates.length - 2 ? index + 2: index + 1;
          start = dates[index].date;
      } else if (currentItem.availability === "unavailable" && nextItem.availability === "available"){
        updatedAvail.push({ 
          start: start, 
          end: currentItem.date, 
          availability: "unavailable"
        })
        start = nextItem.date;
        index++;
      } else {
        //if current item is the second last item
        if(index === (dates.length-2)){
          updatedAvail.push({ 
            start: start, 
            end: nextItem.date, 
            availability: currentItem.availability
          })  
        }
        index++;
      }

    }

    return updatedAvail;

  } catch ( error ) {
    console.error('Error:', error.message);   
    return null;

  } finally {
    await page.waitForTimeout(2000);
  }

}

function getCurrentAndEndDate(months){
  var numberMonths = parseInt(months, 10); 
  var currentDate = new Date();
  var EndDate = addDays(addMonths(currentDate, numberMonths), 1);

  return { currentDate, EndDate };
}

async function getResortAddress(resortID, sElement){
  const browser = sharedData.browser;
  try {
    const pageForAddress = await browser.newPage();

    url = `https://clubwyndham.wyndhamdestinations.com/us/en/resorts/resort-search-results`;
    await pageForAddress.goto(url);

    await pageForAddress.waitForTimeout(2000);

    const placeholderText = 'Enter a location';
    const inputSelector = `input[placeholder="${placeholderText}"]`;
    const textToEnter = sElement;
    const id = resortID.replace("|","");
  
    // Type text into the input field
    await pageForAddress.type(inputSelector, textToEnter);
  
    // Simulate pressing the Enter key
    await pageForAddress.keyboard.press('Enter');

    const resortCardSelector = `#${id}.resort-card`;
    const resortCardElement = await pageForAddress.waitForSelector(resortCardSelector, { timeout: 10000 });
    const resortCardAddressSelector = '.resort-card__address';
    await resortCardElement.waitForSelector(resortCardAddressSelector, { timeout: 10000 });

    let resortAddress = await resortCardElement.$eval(resortCardAddressSelector, (element) => {
      return element.textContent;
    });

    resortAddress = resortAddress.replace(/\s+/g, ' ').trim();

    await pageForAddress.close();
    
    return resortAddress;

  } catch (error) {
    console.error('Error:', error.message);
    return null;  
  } 

}

module.exports = {
  executeScraper,
  login,
  sendOTP,
  launchPuppeteer
};