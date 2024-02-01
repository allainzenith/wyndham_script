////////////////////////////////////////////////////////////////////
// THIS IS A SERVICE FOR SCRAPING DATA FROM THE WYNDHAM WEBSITE
////////////////////////////////////////////////////////////////////

const path = require("path");
const { addMonths, addDays, endOfMonth } = require("date-fns");
const { userName, passWord } = require("../config/config");
const { oneTimeTaskPuppeteer, tierOnePuppeteer, tierTwoThreePuppeteer, sharedData } = require("../config/puppeteerOptions");

let needtoLogin;

let oneTimeNeedLogin = true;
let tierOneNeedLogin = true;
let tierTwoThreeNeedLogin = true;

async function executeScraper(queueType, resortID, suiteType, months, resortHasNoRecord, browser, page, pageForAddress) {
  try {
    let doneLogin, doneSelecting, doneScraping, doneGettingAddress, address, updatedAvail, sElement;

    switch(queueType) {
      case "ONE TIME":
        needtoLogin = oneTimeNeedLogin;
        break;
      case "TIER 1":
        needtoLogin = tierOneNeedLogin;
        break;
      case "TIER 2":
      case "TIER 3":
        needtoLogin = tierTwoThreeNeedLogin;
        break;
      default:
        console.error(`Unknown task type for launching puppeteer: ${queueType}`);
        return null;
    }

    try {
      console.log("I need to log in: " + needtoLogin);
      doneLogin = needtoLogin ? await login(queueType, page, pageForAddress) : true;
      console.log("Done login: " + doneLogin);
    } catch (error) {
      console.log(
        "Login process failed.", error.message
      );
      return null;      
    }

    try {
      sElement = doneLogin === true ? await selectElements(queueType, resortID, suiteType, page, pageForAddress) : null;
      console.log("Selected Option Text:", sElement);
      doneSelecting = sElement !== null && sElement !== undefined && sElement !== "MAINTENANCE";
      console.log("Done selecting: " + doneSelecting);
    } catch (error) {
      console.log(
        "Selecting process failed.", error.message
      );
      return null;      
    }

    try {
      updatedAvail = doneSelecting ? await checkAvailability(queueType, months, resortID, suiteType, page, pageForAddress) : null;
      doneScraping = updatedAvail !== null && updatedAvail !== undefined && updatedAvail !== "MAINTENANCE";
      console.log("Done scraping: " + doneScraping);
    } catch (error) {
      console.log("eRROR: " , error);
      console.log(
        "Getting availability failed.", error.message
      );
      return null;      
    }

    if (resortHasNoRecord) {
      console.log(
        "No existing listing ID. Getting resort address to match resort with the Guesty listing."
      );
      try {
        address = doneScraping
          ? await getResortAddress(resortID, sElement, pageForAddress)
          : null;
        doneGettingAddress = address !== null && address !== undefined && address !== "MAINTENANCE";
        console.log("Done getting address: " + doneGettingAddress);
        console.log("address: " + address);
      } catch (error) {
        console.log(
          "Getting address failed."
        );
        return null;      
      }
    } else {
      console.log(
        "The fields for this record are populated. No need to get the address for matching."
      );
      doneGettingAddress = true;
    }

    if (doneLogin && doneSelecting && doneScraping && doneGettingAddress) {
      console.log("Done scraping. Calendar updating...");
      return { address, updatedAvail, sElement };
    } if (doneLogin === "MAINTENANCE" || sElement === "MAINTENANCE" || updatedAvail === "MAINTENANCE" || address === "MAINTENANCE") {
      return "MAINTENANCE";
    } else {
      console.log(
        "One or more of the scraping processes did not execute successfully. Please try again."
      );
      return null;
    }

  } catch (error) {
    console.error("Error executing scraper:", error.message);
    return null;
  }

}

async function launchPuppeteer(queueType) {
  try {

    let page, pageForAddress;
    switch(queueType) {
      case "ONE TIME":
        await oneTimeTaskPuppeteer();
        page = sharedData.oneTimePage;
        pageForAddress = sharedData.oneTimeAddressPage;
        break;
      case "TIER 1":
        await tierOnePuppeteer();
        page = sharedData.tierOnePage;
        pageForAddress = sharedData.tierOneAddressPage;
        break;
      case "TIER 2":
        await tierTwoThreePuppeteer();
        page = sharedData.tierTwoThreePage;
        pageForAddress = sharedData.tierTwoThreeAddressPage;
        break;
      case "TIER 3":
        await tierTwoThreePuppeteer();
        page = sharedData.tierTwoThreePage;
        pageForAddress = sharedData.tierTwoThreeAddressPage;
        break;
      default:
        console.error(`Unknown task type for launching puppeteer: ${queueType}`);
    }

    let loggedIn = await login(queueType, page, pageForAddress);
    
    return loggedIn;
  } catch (error) {
    return null;
  }
}

async function login(queueType, page, pageForAddress) {
  let checkToBegin = true;

  while (checkToBegin) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    try {
      page;
      pageForAddress;
      checkToBegin = false;
    } catch (error) {
      console.log("Error waiting for pages: ", error.message);
    }
  }

  try {
    try {
      await Promise.all([
        page.waitForNavigation(), 
        page.bringToFront(),
        page.goto("https://clubwyndham.wyndhamdestinations.com/us/en/login"),
      ]);

    } catch (error) {
      console.log("Error at the start:", error.message);
      return null;
    }

    if (await page.url() !== "https://clubwyndham.wyndhamdestinations.com/us/en/login"){
      return "MAINTENANCE";
    }

    else {
      await Promise.all([
        pageForAddress.waitForNavigation(), 
        pageForAddress.bringToFront(),
        pageForAddress.goto(
          `https://clubwyndham.wyndhamdestinations.com/us/en/resorts/resort-search-results`
        )
      ]);

      if (await pageForAddress.url() !== "https://clubwyndham.wyndhamdestinations.com/us/en/resorts/resort-search-results"){
        return "MAINTENANCE";
      }

      let addressSelectorFound = 0;

      while (addressSelectorFound < 5) {
        try {
          await pageForAddress.waitForSelector(`.resort-card`, {
            timeout: 60000,
          });
          await pageForAddress.waitForSelector(`.resort-card__address`, {
            timeout: 60000,
          });       
          console.log("resorts fully loaded.");
          addressSelectorFound = 5;
        } catch (error) {
          addressSelectorFound++;
          console.log("Timed out. Reloading the page.");
          await Promise.all([
            pageForAddress.waitForNavigation(), 
            pageForAddress.reload()
          ]);
        }
      }

      await page.bringToFront();
      console.log("I'M ON THE LOGIN PAGE");

      let loginSelector = await page.$(`.button-primary[value*="Login"]`);
      await loginSelector.scrollIntoView();

      await checkOverlay(page);

      await page.type("#okta-signin-username", userName);
      await page.type("#okta-signin-password", passWord);
      await page.waitForTimeout(5000);
      await page.click(`.button-primary[value*="Login"]`)

      let isVerified = await findSendSmsCode(queueType, page, pageForAddress);

      return isVerified;
    }

  } catch (error) {
    console.error("Error logging in:", error.message);
    return null;

  } 

}

async function findSendSmsCode(queueType, page, pageForAddress){

  // Click the <a> tag with a specific data-se attribute value
  const dataSeValue = "sms-send-code";
  const selector = `a[data-se="${dataSeValue}"]`;

  try {
    await page.waitForSelector(selector);
    console.log("send-code button found");
    await page.waitForTimeout(3000);
    await page.click(selector);
    console.log("We need OTP verification!");

    return false;

  } catch (error) {
    let checkIfLoggedIn = 0;

    while (checkIfLoggedIn < 5) {
      let doneLogin = await isLoggedIn(page);
    
      if(doneLogin) {
        console.log("No need for OTP verification");
        console.log("Logged in successfullyyyy!!");  
  
        switch(queueType) {
          case "ONE TIME":
            oneTimeNeedLogin = false;
            break;
          case "TIER 1":
            tierOneNeedLogin = false;
            break;
          case "TIER 2":
          case "TIER 3":
            tierTwoThreeNeedLogin = false;
            break;
          default:
            console.error(`Unknown task type for launching puppeteer: ${queueType}`);
        }
        
        checkIfLoggedIn = 5;
        return true;
      } else {
        console.log("Not logged in");
        checkIfLoggedIn++;

        try {
          let doneLogin = await login(queueType, page, pageForAddress);
          console.log("Done login: ", doneLogin);

        } catch (error) {
          console.log("Can't submit");
          console.log("Error message: ", error.message);
        }
  
      }

    }

    return null;

  }
}

async function isLoggedIn(page) {
  const accountURL = 'https://clubwyndham.wyndhamdestinations.com/us/en/owner/account';
  try {
    await page.waitForFunction(
      (url) => window.location.href.includes(url),
      { timeout: 20000 },
      accountURL
    );
    console.log('Navigation to', accountURL, 'completed within the timeout');
    return true;
  } catch (error) {
    console.error('Navigation did not complete within the timeout:', error.message);
    return false;
  }
}

async function sendOTP(verOTP, queueType, page, pageForAddress) {

  try {
    await page.waitForSelector('#input60', {timeout:3000});
    await page.$eval("#input60", input => input.value = '');
    await page.type("#input60", verOTP);
    console.log("Inputted code");
    await page.waitForSelector('#input69', {timeout:3000});
    await page.click("#input69");
    console.log("Clicked remember device");
    await page.waitForTimeout(2000);
    await page.waitForSelector('input[type="submit"]', {timeout:3000});
    await page.click('input[type="submit"]');
    console.log("Hit submit button");
      
    let doneLogin = await isLoggedIn(page);
  
    if(doneLogin) {
      console.log("No need for OTP verification");
      console.log("Logged in successfullyyyy!!");  

      switch(queueType) {
        case "ONE TIME":
          oneTimeNeedLogin = false;
          break;
        case "TIER 1":
          tierOneNeedLogin = false;
          break;
        case "TIER 2":
        case "TIER 3":
          tierTwoThreeNeedLogin = false;
          break;
        default:
          console.error(`Unknown task type for launching puppeteer: ${queueType}`);
      }

      return true;
    } else {
      console.log("Hit submit button but didn't navigate");

      await page.waitForSelector('#error-fragment', {timeout:3000, visible: true});
      console.log("error selector found")
      console.log("The token code is incorrect");
      return false;
    }

  } catch (error) {
    console.error("Error sending OTP:", error.message);
    let doneLogin = await login(queueType, page, pageForAddress)
    let retry = doneLogin ? await sendOTP(verOTP, queueType, page, pageForAddress) : null;
    return retry;
  } 

}

async function resendSmsCode(queueType) {
  return new Promise(async(resolve) => {
    let browser, page, pageForAddress;

    switch(queueType) {
      case "ONE TIME":
        browser = sharedData.oneTimeBrowser;
        page = sharedData.oneTimePage;
        pageForAddress = sharedData.pageForAddress;
        break;
      case "TIER 1":
        browser = sharedData.tierOneBrowser;
        page = sharedData.tierOnePage;
        pageForAddress = sharedData.tierOneAddressPage;
        break;
      case "TIER 2":
      case "TIER 3":
        browser = sharedData.tierTwoThreeBrowser;
        page = sharedData.tierTwoThreePage;
        pageForAddress = sharedData.tierTwoThreeAddressPage;
        break;
      default:
        resolve(null);
    }

    try {

      if (await page.url() !== "https://clubwyndham.wyndhamdestinations.com/us/en/login"){
        resolve("MAINTENANCE");
        await browser.close();
      } else {
        let needsVerify = await findSendSmsCode();
        resolve(!needsVerify);
      }
    } catch (error) {
      console.error("Error resending OTP:", error.message);
      login(queueType, page, pageForAddress)
      .then(needsVerify => {
        resolve(needsVerify);
      })
      .catch(error => {
        console.error(error);
        resolve(null);
      });
    } 

  });
}
async function enableSessionCalendar(page){
  try {
    await page.goto('https://clubwyndham.wyndhamdestinations.com/us/en/resorts/resort-search-results');

    let addressSelectorFound = 0;

    while (addressSelectorFound < 5) {
      try {
        await page.waitForSelector(`.resort-card`, {
          timeout: 10000,
        });
        await page.waitForSelector(`.resort-card__address`, {
          timeout: 10000,
        });       
        console.log("resorts fully loaded.");
        console.log("navigated to resorts page");
        addressSelectorFound = 5;
      } catch (error) {
        addressSelectorFound++;
        console.log("Timed out. Reloading the page.");
        await Promise.all([
          page.waitForNavigation(), 
          page.reload()
        ]);
      }
    }


    // Replace 'your-div-class' with the actual class name of the div
    const divClassName = 'resort-card__name';

    // Use the attribute selector to find the first <a> tag within the specified div
    const link = await page.$(`div.${divClassName} a`);

    if (link) {

      await Promise.all([
        page.waitForNavigation(), 
        link.click()
      ]);

      let calendarSelector = `a[href*="/us/en/owner/resort-monthly-calendar"]`;
      await page.waitForSelector(calendarSelector);
  
      await Promise.all([
        page.waitForNavigation(), 
        page.click(calendarSelector),
      ]);

      return true;
  
    } else {
      console.error(`Link within div with class "${divClassName}" not found`);

      return null;
    }  
  } catch (error) {
      console.log("Error enabling session calendar: ", error.message);
      return null;    
  }

}

async function checkOverlay(page) {
  const overlaySelector = 'button[aria-label*="Close"]'
  
  const overlayExists = await page.evaluate((selector) => {
    const overlayElement = document.querySelector(selector);
    return overlayElement !== null;
  }, overlaySelector);

  if (overlayExists) {
    await page.evaluate((selector) => {
      const closeButton = document.querySelector(selector);
      if (closeButton) {
        closeButton.click(); 
        return true;
      }
      return false;
    }, overlaySelector);
  }

}

async function selectElements(queueType, resortID, suiteType, page, pageForAddress) {


  let setupSelect = 0;
  while (setupSelect < 5) {
    try {

      await page.bringToFront();
      let calendarUrl = `https://clubwyndham.wyndhamdestinations.com/us/en/owner/resort-monthly-calendar?productId=${resortID}`;

      try {
        await page.waitForFunction(
          (url) => window.location.href.includes(url),
          { timeout: 1000 },
          calendarUrl
        );
        console.log("Already on the calendar URL");
        //IMPORTANT: DO NOT DELETE
        await Promise.all([
          page.waitForNavigation(), 
          page.reload()
        ]);
      } catch (error) {
        console.error("Not on the calendar URL yet: ", error.message);
        console.log("Navigating now..");
        await Promise.all([
          page.waitForNavigation(), 
          page.goto(calendarUrl),
        ]);
      }

      await checkOverlay(page);

      const resortSelector = "#ResortSelect";

      await page.waitForSelector(resortSelector).then(
        async () =>
          (await page.waitForFunction(
            (selector) => {
              const element = document.querySelector(selector);
              return !!element;
            },
            { timeout: 60000 },
            resortSelector
          ))
      );

      const resort  = await page.waitForSelector(resortSelector, {
        timeout: 3000,
      });

      await resort.scrollIntoView();

      let selectedResort = await page.evaluate((selector) => {
        const select = document.querySelector(selector);
        const selectedOption = select.options[select.selectedIndex];
        return selectedOption.value;
      }, resortSelector);

      while (selectedResort !== resortID) {

        await Promise.all([
          page.waitForNavigation(), 
          page.select(resortSelector, resortID)
        ]);
    
        selectedResort = await page.evaluate((selector) => {
          const select = document.querySelector(selector);
          const selectedOption = select.options[select.selectedIndex];
          return selectedOption.value;
        }, resortSelector);
    
        console.log("This is the selected resort:",selectedResort);

        let error = await page.waitForSelector("#error-message", {
          timeout: 15000,
        });

        if(error) {
          return null;
        }
      }

      let selectedOptionText = await page.evaluate((selector) => {
        const select = document.querySelector(selector);
        const selectedOption = select.options[select.selectedIndex];
        return selectedOption.text;
      }, resortSelector);

      console.log("This is the selected option: " + selectedOptionText);

      const suiteSelector = "#suiteType";

      const selectsFilled = await page.waitForFunction(
        (selector) => {
          const select = document.querySelector(selector);
          return select && select.length > 1;
        },
        { timeout: 10000 },
        suiteSelector
      );
      
      let optionExists = false;

      if (selectsFilled) {
        optionExists = await page.evaluate(
          (suiteSelector, suiteType) => {
            const select = document.querySelector(`${suiteSelector}`);
            if (select) {
              const options = Array.from(select.options);
              return options.some((option) => option.value === suiteType);
            }
            return false;
          },
          suiteSelector,
          suiteType
        );
      }

      if (optionExists) {
        try {
          let purchaseType = null;
          const purchaseSelector = "#purchaseType";
          await page.waitForSelector(purchaseSelector, {timeout: 10000});
          while (purchaseType !== "Developer") {
            await page.select(purchaseSelector, "Developer");

            purchaseType = await page.evaluate((selector) => {
              const select = document.querySelector(selector);
              const selectedOption = select.options[select.selectedIndex];
              return selectedOption.text;
            }, purchaseSelector);

            console.log("This is the selected purchase type:",purchaseType);
          } 
        } catch (error) {
          console.log("Purchase type can't be selected.")
        }

        setupSelect = 5;

        //====================================================================
        // SELECTING SUITE TYPE
        //====================================================================

        const suiteSelector = "#suiteType";

        let selectedOption = await page.evaluate((selector) => {
          const select = document.querySelector(selector);
          const selectedOption = select.options[select.length-1];
          return selectedOption.text;
        }, suiteSelector);

        console.log("Selected option: ", selectedOption);

        // IMPORTANT
        let selectedSuiteType = await page.select(suiteSelector, selectedOption);

        while (selectedSuiteType !== suiteType) {
          await page.select(suiteSelector, suiteType);

          selectedSuiteType = await page.evaluate((selector) => {
            const select = document.querySelector(selector);
            const selectedOption = select.options[select.selectedIndex];
            return selectedOption.text;
          }, suiteSelector);

          console.log("This is the selected suite type:",selectedSuiteType);
        }

        //====================================================================
        // END OF SELECTING SUITE TYPE
        //====================================================================

        return selectedOptionText;


      } else {
        console.log(
          `The option with value "${suiteType}" does not exist in the select element.`
        );
        console.log(
          `Reloading calendar page now..`
        );
        
        setupSelect++;

        if (setupSelect === 5) return null;
      }
    } catch (error) {
      console.error("Error selecting elements:", error.message);
      setupSelect++;
      
      let doneLogin = await login(queueType, page, pageForAddress);
      console.log("logged in successfully: ", doneLogin);
      
      if (setupSelect === 5 && doneLogin !== true) return null;
    }
  }
}


async function checkAvailability(queueType, months, resortID, suiteType, page, pageForAddress) {

  let numResponses = 0;
  
  let { currentDate } = getCurrentAndEndDate(months);
  let monthNow = 0;
  let dates = [];
  let responses = [];
  
  
  let currentMonth;
  let currentYear;
  let lastDay;

  let initialDate;
  
  try {
  
    while (monthNow <= months) {   

      currentMonth = currentDate.toLocaleDateString(undefined, {
        month: "2-digit",
      });   
      initialDate = monthNow === 0 ? currentDate.toLocaleDateString(undefined, { day: "2-digit" }) : '01';
      currentYear = currentDate.getFullYear();

      // Getting the day of the month
      lastDay = endOfMonth(currentDate).toLocaleDateString(undefined, { day: "2-digit" });

      await page.waitForResponse( async response => {
        if (response.request().method() === "POST" && await response.status() === 200 &&
        response.url().includes('https://api.wvc.wyndhamdestinations.com/resort-operations/v3/resorts/calendar/availability') ) {
          const postData = await response.request().postData();
          const responseText = await response.text();
  
          if ( postData && postData.includes(resortID) && postData.includes(suiteType) &&
            responseText.includes(`${currentYear}-${currentMonth}`)
          ) {
            if ( responseText.includes(`${currentYear}-${currentMonth}-${initialDate}`) ) numResponses++;
            if ( responseText.includes(`${currentYear}-${currentMonth}-${lastDay}`) ) numResponses++;
            const responseData = JSON.parse(responseText);
            let date = responseData.calendarDays[0].date;
            console.log(`Response with date ${date} pushed.`);
            responses.push(responseText);

            if (numResponses >= 2) {
              return true;
            }
          }
        }

      })

      console.log("Done fetching responses..");
        
      try {
        numResponses = 0;
        await page.waitForTimeout(2000);

        if(monthNow < months) {
          let nextClass = `button.react-datepicker__navigation--next[aria-label="Next Month"]`;
          let nextButton = await page.waitForSelector(nextClass, {
            timeout: 30000,
          });
    
          // Click the next button
          await nextButton.scrollIntoView();
          await nextButton.click();
        }

        await checkOverlay(page);

        console.log("Clicked next button.");
  
        currentDate = addMonths(currentDate, 1);
        monthNow++;
  
        
      } catch (error) {
        //error-message (id)

        console.log("Can't find or click next button. Reloading again.", error.message);
  
        let doneSelect = await selectElements(queueType, resortID, suiteType, page, pageForAddress);
        console.log("Reselected elements successfully: ", doneSelect);
        let doneScraping = doneSelect !== null && doneSelect !== undefined ? await checkAvailability( 
          queueType,
          months,
          resortID,
          suiteType,
          page,
          pageForAddress
        ): null;
        console.log(
          "Checked availability successfully: ",
          doneScraping !== null && doneScraping !== undefined
        );
        return doneScraping;
      }
  
    }
    await page.waitForTimeout(2000);
  
    let calendarObj = [];
  
    // Now you can access all captured responses outside the while loop
    for (const responseText of responses) {
      const calendarDays = JSON.parse(responseText).calendarDays;
      calendarObj = calendarObj.concat(calendarDays);
    }
  
    dates = await checkCalendarObject(calendarObj, resortID);
  
    // start of grouping dates together
  
    dates = filterUniqueKeys(dates);
    const compareDates = (a,b) => new Date(a.date) - new Date(b.date);
    dates = dates.sort(compareDates);
  
  
    let index = 0;
    let currentItem;
    let nextItem;
    let updatedAvail = [];
    let start = null;
    while (index <= dates.length - 2) {
      currentItem = dates[index];
      nextItem = dates[index + 1];
  
      if (start === null) {
        start = currentItem.date;
      }
  
      if (
        currentItem.availability === "available" &&
        nextItem.availability === "unavailable"
      ) {
        updatedAvail.push({
          start: start,
          end: nextItem.date,
          availability: "available",
        });
        index = index < dates.length - 2 ? index + 2 : index + 1;
        start = dates[index].date;
      } else if (
        currentItem.availability === "unavailable" &&
        nextItem.availability === "available"
      ) {
        updatedAvail.push({
          start: start,
          end: currentItem.date,
          availability: "unavailable",
        });
        start = nextItem.date;
        index++;
      } else {
        //if current item is the second last item
        if (index === dates.length - 2) {
          updatedAvail.push({
            start: start,
            end: nextItem.date,
            availability: currentItem.availability,
          });
        }
        index++;
      }
    }

    for (const avail of updatedAvail) {
      console.log(avail);
    }
  
    return updatedAvail;
  } catch (error) {
    console.error("Error getting availability:", error.message);
    //try the process one more time
  
    let doneSelect = await selectElements(queueType, resortID, suiteType, page, pageForAddress);
    console.log("Reselected elements successfully: ", doneSelect);
    let doneScraping = doneSelect !== null && doneSelect !== undefined ? await checkAvailability( 
      queueType,
      months,
      resortID,
      suiteType,
      page,
      pageForAddress
    ) : null;
    console.log(
      "Checked availability successfully: ",
      doneScraping !== null && doneScraping !== undefined
    );
    return doneScraping;
  } 
}

function filterUniqueKeys(array) {
  //acc is an object, obj is the value
  const lastOccurrences = array.reduceRight((acc, obj) => {
    if (!acc[obj.date]) {
      acc[obj.date] = obj;
    }
    return acc;
  }, {});
  
  const resultArray = Object.values(lastOccurrences);
  
  return resultArray;
  
}


async function checkCalendarObject(calendarObj, resortID) {
  let dateArr = [];
  let condition; 
  
  for (const item of calendarObj) {

    condition = resortID !== 'PI|R000000000031' ? item.continuousFlag : item.continuousFlag || !item.notAvailable;

    let available = condition ? "available" : "unavailable";
    dateArr.push({
      date: item.date,
      availability: available,
    });

  }
  
  return dateArr;

}

function getCurrentAndEndDate(months) {
  let numberMonths = parseInt(months, 10);
  let currentDate = new Date();
  let EndDate = addDays(addMonths(currentDate, numberMonths), 1);

  return { currentDate, EndDate };
}

async function getResortAddress(resortID, sElement, pageForAddress) {
  try {
    await pageForAddress.bringToFront();
    const placeholderText = "Enter a location";
    const inputSelector = `input[placeholder="${placeholderText}"]`;
    const textToEnter = sElement;
    const id = resortID.replace("|", "");
    const resortCardSelector = `#${id}.resort-card`;

    let addressSelectorFound = 0;
    let addressFound;
    while (addressSelectorFound < 5) {
      try {
        await pageForAddress.type(inputSelector, textToEnter);
        await pageForAddress.keyboard.press("Enter");

        addressFound = await pageForAddress.waitForSelector(
          resortCardSelector,
          { timeout: 60000 }
        );

        addressSelectorFound = 5;
      } catch (error) {
        console.log("Timed out. Reloading the page.");
        addressSelectorFound++;
        await Promise.all([
          pageForAddress.waitForNavigation(), 
          pageForAddress.reload()
        ]);
      }
    }

    if (addressFound) {
      let resortAddress = await pageForAddress.evaluate(
        (outerSelector, innerSelector) => {
          const outerDiv = document.querySelector(outerSelector);
          if (outerDiv) {
            const innerDiv = outerDiv.querySelector(innerSelector);
            return innerDiv ? innerDiv.textContent.trim() : null;
          }
          return false;
        },
        resortCardSelector,
        ".resort-card__address"
      );

      resortAddress = resortAddress.replace(/\s+/g, " ").trim();

      return resortAddress;
    }
  } catch (error) {
    console.error("Error getting resort address:", error.message);
    return null;
  }
}

module.exports = {
  executeScraper,
  resendSmsCode,
  sendOTP,
  launchPuppeteer,
  login,
  getCurrentAndEndDate
};