////////////////////////////////////////////////////////////////////
// THIS IS A SERVICE FOR SCRAPING DATA FROM THE WYNDHAM WEBSITE
////////////////////////////////////////////////////////////////////

const path = require("path");
const { addMonths, addDays } = require("date-fns");
const { userName, passWord } = require("../config/config");
const { globals, sharedData } = require("../config/puppeteerOptions");

let needtoLogin;

async function executeScraper(resortID, suiteType, months, resortHasNoRecord) {
  try {
    let doneLogin, doneSelecting, doneScraping, doneGettingAddress, address, updatedAvail, sElement;

    try {
      console.log("I need to log in: " + needtoLogin);
      doneLogin = needtoLogin ? await login() : true;
      console.log("Done login: " + doneLogin);
    } catch (error) {
      console.log(
        "Login process failed."
      );
      return null;      
    }

    try {
      sElement = doneLogin === true ? await selectElements(resortID, suiteType) : null;
      console.log("Selected Option Text:", sElement);
      doneSelecting = sElement !== null;
      console.log("Done selecting: " + doneSelecting);
    } catch (error) {
      console.log(
        "Selecting process failed."
      );
      return null;      
    }

    try {
      updatedAvail = doneSelecting ? await checkAvailability(months, resortID, suiteType) : null;
      doneScraping = updatedAvail !== null;
      console.log("Done scraping: " + doneScraping);
    } catch (error) {
      console.log(
        "Getting availability failed."
      );
      return null;      
    }

    if (resortHasNoRecord) {
      console.log(
        "No existing listing ID. Getting resort address to match resort with the Guesty listing."
      );
      try {
        address = doneScraping
          ? await getResortAddress(resortID, sElement)
          : null;
        doneGettingAddress = address !== null;
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
    } if (doneLogin === "MAINTENANCE") {
      return "MAINTENANCE";
    } else {
      console.log(
        "One or more of the scraping processes did not execute successfully. Please try again."
      );
      return null;
    }
  } catch (error) {
    console.error("Error:", error.message);
    return null;
  }
}

async function launchPuppeteer() {
  try {
    needtoLogin = true;
    await globals();
    let loggedIn = await login();
    return loggedIn;
  } catch (error) {
    return null;
  }
}

async function login() {
  let checkToBegin = true;

  while (checkToBegin) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    try {
      sharedData.page;
      sharedData.pageForAddress;
      checkToBegin = false;
    } catch (error) {
      console.log("Error: ", error.message);
    }
  }

  try {
    const page = sharedData.page;
    const pageForAddress = sharedData.pageForAddress;

    try {
      await Promise.all([
        page.waitForNavigation(), 
        page.bringToFront(),
        page.goto("https://clubwyndham.wyndhamdestinations.com/us/en/login"),
      ]);

    } catch (error) {
      console.log("Error at the start:",error.message);
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
          await pageForAddress.reload();
        }
      }

      await page.bringToFront();
      console.log("I'M ON THE LOGIN PAGE");

      let loginSelector = await page.$(`.button-primary[value*="Login"]`);
      await loginSelector.scrollIntoView();

      await checkOverlay();

      await page.type("#okta-signin-username", userName);
      await page.type("#okta-signin-password", passWord);
      await page.waitForTimeout(5000);
      await page.click(`.button-primary[value*="Login"]`)

      let isVerified = await findSendSmsCode();

      return isVerified;
    }

  } catch (error) {
    console.error("Error:", error.message);
    return null;

  } 

}

async function findSendSmsCode(){
  const page = sharedData.page;

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
      let doneLogin = await isLoggedIn();
    
      if(doneLogin) {
        console.log("No need for OTP verification");
        console.log("Logged in successfullyyyy!!");  
  
        // let canSelect = await enableSessionCalendar();
        // returnValue = canSelect;
        needtoLogin = false;
        checkIfLoggedIn = 5;
        return true;
      } else {
        console.log("Error: ", error.message);
        checkIfLoggedIn++;

        try {
          let doneLogin = await login();
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

async function isLoggedIn() {
  const page = sharedData.page;
  const accountURL = 'https://clubwyndham.wyndhamdestinations.com/us/en/owner/account';
  try {
    await page.waitForFunction(
      (url) => window.location.href.includes(url),
      { timeout: 30000 },
      accountURL
    );
    console.log('Navigation to', accountURL, 'completed within the timeout');
    return true;
  } catch (error) {
    console.error('Navigation did not complete within the timeout:', error.message);
    return false;
  }
}

async function sendOTP(verOTP) {
  const page = sharedData.page;

  try {
    await page.waitForSelector('#input60', {timeout:3000});
    await page.type("#input60", verOTP);
    console.log("Inputted code");
    await page.waitForSelector('#input69', {timeout:3000});
    await page.click("#input69");
    console.log("Clicked remember device");
    await page.waitForTimeout(2000);
    await page.waitForSelector('input[type="submit"]', {timeout:3000});
    await page.click('input[type="submit"]');
    console.log("Hit submit button");
      
    let doneLogin = await isLoggedIn();
  
    if(doneLogin) {
      console.log("No need for OTP verification");
      console.log("Logged in successfullyyyy!!");  
      needtoLogin = false;
      return true;
    } else {
      console.log("Hit submit button but didn't navigate");

      await page.waitForSelector('#error-fragment', {timeout:3000, visible: true});
      console.log("error selector found")
      console.log("The token code is incorrect");
      return false;
    }

  } catch (error) {
    console.error("Error:", error.message);
    return null;
  } 

}

async function resendSmsCode() {
  return new Promise(async(resolve) => {
    try {
      const page = sharedData.page;
      const browser = sharedData.browser;
      if (await page.url() !== "https://clubwyndham.wyndhamdestinations.com/us/en/login"){
        resolve("MAINTENANCE");
        await browser.close();
      } else {
        let needsVerify = await findSendSmsCode();
        resolve(!needsVerify);
      }
    } catch (error) {
      console.error("Error:", error.message);
      login()
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
async function enableSessionCalendar(){
  const page = sharedData.page;
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
        await page.reload();
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
      console.log("Error: ", error.message);
      return null;    
  }

}

async function checkOverlay() {
  const page = sharedData.page;
  const overlaySelector = '.onetrust-close-btn-handler[aria-label*="Close"]'
  
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

async function selectElements(resortID, suiteType) {
  const page = sharedData.page;


  let setupSelect = 0;
  while (setupSelect < 5) {
    try {

      await page.bringToFront();
      await page.waitForTimeout(5000);
      var calendarUrl = `https://clubwyndham.wyndhamdestinations.com/us/en/owner/resort-monthly-calendar?productId=${resortID}`;

      try {
        await page.waitForFunction(
          (url) => window.location.href.includes(url),
          { timeout: 1000 },
          calendarUrl
        );
        console.log("Already on the calendar URL");
        await Promise.all([
          page.waitForNavigation(), 
          page.reload()
        ]);
      } catch (error) {
        console.error("Not on the calendar URL yet: ", error.message);
        console.log("Navigating now..");
        await Promise.all([
          page.waitForNavigation(), 
          page.goto(calendarUrl)
        ]);
      }

      await checkOverlay();

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
              console.log("options: " + options);
              return options.some((option) => option.value === suiteType);
            }
            return false;
          },
          suiteSelector,
          suiteType
        );
      }

      if (optionExists) {

        let purchaseType = null;
        const purchaseSelector = "#purchaseType";
        while (purchaseType !== "Developer") {
          await page.select(purchaseSelector, "Developer");

          purchaseType = await page.evaluate((selector) => {
            const select = document.querySelector(selector);
            const selectedOption = select.options[select.selectedIndex];
            return selectedOption.text;
          }, purchaseSelector);

          console.log("This is the selected purchase type:",purchaseType);
        }

        await page.waitForTimeout(5000);

        setupSelect = 5;

        //====================================================================
        // SELECTING SUITE TYPE
        //====================================================================

        const suiteSelector = "#suiteType";

        let selectedSuiteType = await page.select(suiteSelector, "All Suites");

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
      console.error("Error:", error.message);
      setupSelect++;
      
      let doneLogin = await login();
      console.log("logged in successfully: ", doneLogin);
      
      if (setupSelect === 5 && doneLogin !== true) return null;
    }
  }
}

async function checkAvailability(months, resortID, suiteType) {
  const page = sharedData.page;
      await page.setRequestInterception(true);

  // Define the request listener function
  const requestListener = async interceptedRequest => {
    // Check if the request URL meets a certain condition
    if (interceptedRequest.url().includes('https://api.wvc.wyndhamdestinations.com/resort-operations/v3/resorts/calendar/availability' && interceptedRequest.method() === 'POST')) {
      // Access the request post data (payload)
      const postData = interceptedRequest.postData();

      if (postData && postData.includes(resortID) && postData.includes(suiteType)) {
        interceptedRequest.continue();
      } else {
        interceptedRequest.abort();
      }
    } else {
      interceptedRequest.continue();
    }
  };

  try {
    var { currentDate } = getCurrentAndEndDate(months);
    var dates = [];
    let monthNow = 0;
    let responses = [];

    await page.on('request', requestListener);

    while (monthNow <= months) {   

      let currentMonth = currentDate.toLocaleDateString(undefined, {
        month: "2-digit",
      });   
      let initialDate = monthNow === 0 ? currentDate.toLocaleDateString(undefined, { day: "2-digit" }) : '01';
      let currentYear = currentDate.getFullYear();

      let secondResponseStart =
      parseInt(currentMonth, 10) < 8
        ? parseInt(currentMonth, 10) % 2 !== 0
          ? "18"
          : "17"
        : (parseInt(currentMonth, 10) + 1) % 2 !== 0
        ? "18"
        : "17";

      let numResponses = 0;
      let resolveResponsesPromise;

      // Set up event listener for intercepted responses
      const responseListener = async interceptedResponse => {
        // Check if the response URL meets a certain condition
        if (
          interceptedResponse.status() !== 302 && interceptedResponse.status()  === 200 &&
          interceptedResponse.url().includes('https://api.wvc.wyndhamdestinations.com/resort-operations/v3/resorts/calendar/availability')
        ) {
          const responseText = await interceptedResponse.text();

          firstObjectFound = responseText.includes(`${currentYear}-${currentMonth}-${initialDate}`);
          secondObjectFound = responseText.includes(`${currentYear}-${currentMonth}-${secondResponseStart}`);

          if(firstObjectFound || secondObjectFound) {
            responses.push(responseText);
            numResponses++;

            if (firstObjectFound) {
              console.log(`F: Response with the date string ${currentYear}-${currentMonth}-${initialDate} pushed.`);  
            } if (secondObjectFound) {
              console.log(`S: Response with the date string ${currentYear}-${currentMonth}-${secondResponseStart} pushed.`);
            }

            let expectedResponses = (parseInt(initialDate, 10) < parseInt(secondResponseStart, 10)) ? 2 : 1;

            // Check if all expected responses are received
            if (numResponses >= expectedResponses) {
              resolveResponsesPromise(); 
            }

          }
        }
      };

      // Function to create a promise that resolves when all responses are received
      const waitForResponses = () => new Promise(resolve => (resolveResponsesPromise = resolve));

      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Timeout waiting for responses')), 30000); // 30 seconds timeout
      });


      // Add the request listener
      await page.on('response', responseListener);


      await Promise.race([timeoutPromise, waitForResponses()]);

      console.log("Done fetching responses..");

      let findNextButtonAttempts = 0;
      while (findNextButtonAttempts < 5) {
        try {
          numResponses = 0;
          await page.waitForTimeout(2000);
          var nextClass = `.react-datepicker__navigation--next[aria-label="Next Month"]`;
          var nextButton = await page.waitForSelector(nextClass, {
            timeout: 10000,
          });
    
          // Click the next button
          await nextButton.scrollIntoView();
          await nextButton.click();
          console.log("Clicked next button.");

          currentDate = addMonths(currentDate, 1);
          firstResponseNotResolved = true;
          monthNow++;

          findNextButtonAttempts = 5;

          await page.off('response', responseListener);
        } catch (error) {
          findNextButtonAttempts++;
          console.log("Can't find or click next button. Reloading again.");
          await page.off('request', requestListener);
          await page.off('response', responseListener);
          await page.reload();
          let doneSelect = await selectElements(resortID, suiteType);
          console.log("Reselected elements successfully: ", doneSelect);
          let doneScraping = doneSelect !== null ? await checkAvailability(
            months,
            resortID,
            suiteType
          ): null;
          console.log(
            "Checked availability successfully: ",
            doneScraping !== null
          );
          return doneScraping;
        }
    

      }

    }
    await page.waitForTimeout(2000);

    let calendarObj = [];

    // Now you can access all captured responses outside the while loop
    for (const responseText of responses) {
      // const responseText = JSON.parse(await response.text());
      const calendarDays = JSON.parse(responseText).calendarDays;
      calendarObj = calendarObj.concat(calendarDays);
    }

    dates = await checkCalendarObject(calendarObj);

    // start of grouping dates together

    dates = filterUniqueKeys(dates);
    const compareDates = (a,b) => new Date(a.date) - new Date(b.date);
    dates = dates.sort(compareDates);
    
    var index = 0;
    var currentItem;
    var nextItem;
    var updatedAvail = [];
    var start = null;
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
    await page.off('request', requestListener);
    await page.setRequestInterception(false);

    return updatedAvail;
  } catch (error) {
    console.error("Error:", error.message);
    await page.off('request', requestListener);
    await page.setRequestInterception(false);

    //try the process one more time
    await page.reload();
    let doneSelect = await selectElements(resortID, suiteType);
    console.log("Reselected elements successfully: ", doneSelect);
    let doneScraping = doneSelect !== null ? await checkAvailability(
      months,
      resortID,
      suiteType
    ) : null;
    console.log(
      "Checked availability successfully: ",
      doneScraping !== null
    );
    return doneScraping;
  } 
}

function isCorrectResponse(responseText, dateString, suiteType, resortID) {
  try {
    const response = JSON.parse(responseText);
    const responseDate = response.calendarDays[0].date;  

    let responseSuite, resID;
    const calendarDays = response.calendarDays
    for (const item of calendarDays) {
      const inventoryOfferings = item.inventoryOfferings;

      if (inventoryOfferings !== undefined) {
        for(const obj of inventoryOfferings) {
          responseSuite = obj.pointsRoomType;
          resID = obj.productOffrngId;

          if (responseSuite !== undefined && resID !== undefined) {
            break;
          }
        }
      }

      if (responseSuite !== undefined && resID !== undefined) {
        break;
      }
    }

    if (responseSuite === undefined || resID === undefined) return true;
    else return responseDate === dateString && responseSuite.toUpperCase().includes(suiteType.toUpperCase()) && resID.toUpperCase().includes(resortID.toUpperCase());

  } catch (error) {
    console.log("Error parsing response: ", error.message);
    return false;
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


async function checkCalendarObject(calendarObj) {
  let dateArr = [];
  
  for (const item of calendarObj) {
    let available = item.continuousFlag ? "available" : "unavailable";
    dateArr.push({
      date: item.date,
      availability: available,
    });

  }
  
  return dateArr;

}

function getCurrentAndEndDate(months) {
  var numberMonths = parseInt(months, 10);
  var currentDate = new Date();
  var EndDate = addDays(addMonths(currentDate, numberMonths), 1);

  return { currentDate, EndDate };
}

async function getResortAddress(resortID, sElement) {
  const pageForAddress = sharedData.pageForAddress;
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
        await pageForAddress.reload();
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
    console.error("Error:", error.message);
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
