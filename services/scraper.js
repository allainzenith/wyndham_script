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
    console.log("I need to log in: " + needtoLogin);
    let doneLogin = needtoLogin ? await login() : true;
    console.log("Done login: " + doneLogin);

    let sElement = doneLogin === true ? await selectElements(resortID, suiteType) : null;
    console.log("Selected Option Text:", sElement);
    let doneSelecting = sElement !== null;
    console.log("Done selecting: " + doneSelecting);

    let updatedAvail = doneSelecting ? await checkAvailability(months, resortID, suiteType) : null;
    let doneScraping = updatedAvail !== null;
    console.log("Done scraping: " + doneScraping);

    let address, doneGettingAddress;
    if (resortHasNoRecord) {
      console.log(
        "No existing listing ID. Getting resort address to match resort with the Guesty listing."
      );
      address = doneScraping
        ? await getResortAddress(resortID, sElement)
        : null;
      doneGettingAddress = address !== null;
      console.log("Done getting address: " + doneGettingAddress);
      console.log("address: " + address);
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
    // return true;
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
      { timeout: 60000 },
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

    await Promise.all([
      page.waitForNavigation(), 
      page.click('input[type="submit"]')
    ]);

    console.log("Hit submit button");

    try {
      await page.waitForSelector('#error-fragment', {timeout:3000, visible: true});
      console.log("error selector found")
      console.log("The token code is incorrect");
      return false;
    } catch (error) {

      let doneLogin = await isLoggedIn();
    
      if(doneLogin) {
        console.log("No need for OTP verification");
        console.log("Logged in successfullyyyy!!");  
        needtoLogin = false;
        return true;
      } else {
        console.log("Error: ", error.message);
        return null;
      }
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
        resolve(needsVerify);
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

      console.log("this is the selected option: " + selectedOptionText);

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
        let selectedSuiteType = await page.select(suiteSelector, "All Suites");

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

        while (selectedSuiteType !== suiteType) {
          await page.select(suiteSelector, suiteType);

          selectedSuiteType = await page.evaluate((selector) => {
            const select = document.querySelector(selector);
            const selectedOption = select.options[select.selectedIndex];
            return selectedOption.text;
          }, suiteSelector);

          console.log("This is the selected suite type:",selectedSuiteType);
        }

        setupSelect = 5;
  
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


async function findDateSelector(month, day, suiteType) {
  const page = sharedData.page;
  let dateElement = null;
  let dayClass = `.react-datepicker__day--0${day}[aria-label*="${month}"]`;

  const suiteSelector = "#suiteType";
                    
  let selectedSuiteType = await page.evaluate((selector) => {
      const select = document.querySelector(selector);
      const selectedOption = select.options[select.selectedIndex];
      return selectedOption.text;
  }, suiteSelector);

  if (selectedSuiteType !== suiteType) {
    console.log("Sayop ang suite type");
    return null;
  } else {
    try {
      dateElement = await page.waitForSelector(dayClass, {
        timeout: 5000,
      });
      await dateElement.scrollIntoView();
    } catch (error) {
      console.log("Can't find date element. Error: ", error.message)
    
    }
  }

  return dateElement;

}

async function checkAvailability(months, resortID, suiteType) {
  const page = sharedData.page;

  try {
    var { currentDate, EndDate } = getCurrentAndEndDate(months);
    let initialCurrentDate = currentDate;
    var dates = [];
    var available;

    var month = currentDate.toLocaleDateString(undefined, {
      month: "long",
    });
    var day = currentDate.toLocaleDateString(undefined, {
      day: "2-digit",
    });

    await page.waitForTimeout(5000);

    await findDateSelector(month, day, suiteType)

    while (currentDate <= EndDate) {
      try {
        month = currentDate.toLocaleDateString(undefined, {
          month: "long",
        });
        day = currentDate.toLocaleDateString(undefined, {
          day: "2-digit",
        });

        var dateElement = await findDateSelector(month, day, suiteType);

        if (dateElement !== null) {
          await dateElement.scrollIntoView();

          var ariaDisabledValue = await dateElement.evaluate((element) => {
            // Use the element.getAttribute() method to get the value of aria-disabled
            return element.getAttribute("aria-disabled");
          });

          available =
            ariaDisabledValue === "true" ? "unavailable" : "available";
          dates.push({
            date: currentDate.toLocaleDateString("en-CA"),
            availability: available,
          });

          currentDate = addDays(currentDate, 1);

          if (
            month !=
            currentDate.toLocaleDateString(undefined, { month: "long" })
          ) {
            let findNextButtonAttempts = 0
            while (findNextButtonAttempts < 5) {
              try {
                var nextClass = `.react-datepicker__navigation--next[aria-label="Next Month"]`;
                var nextButton = await page.waitForSelector(nextClass, {
                  timeout: 10000,
                });
                if (nextButton) {
                  await nextButton.click();
                  console.log("Clicked next button.")
                  await page.waitForTimeout(1000);

                } else {
                  console.log("did not find the button");
                }
                findNextButtonAttempts = 5;
              } catch (error) {
                findNextButtonAttempts++;
                console.log("Can't find next button. Logging in again.");
                dates = [];
                await page.reload();
                let doneSelect = await selectElements(resortID, suiteType);
                console.log("Reselected elements successfully: ", doneSelect);
                let doneScraping = await checkAvailability(months, resortID, suiteType);
                console.log("Checked availability successfully: ", doneScraping !== null);
                return doneScraping;

              }
            }
          }
        } else {
          console.log("Can't find date element. Logging in again.")
          await page.reload();
          let doneSelect = await selectElements(resortID, suiteType);
          console.log("Reselected elements successfully: ", doneSelect);
          let doneScraping = await checkAvailability(months, resortID, suiteType);
          console.log("Checked availability successfully: ", doneScraping !== null);
          return doneScraping;         
        }
        
      } catch (error) {
        console.error("Error:", error.message);
        console.log("Possible select options became null.");
        await page.reload();
        let doneSelect = await selectElements(resortID, suiteType);
        console.log("Reselected elements successfully: ", doneSelect);
        let doneScraping = await checkAvailability(months, resortID, suiteType);
        console.log("Checked availability successfully: ", doneScraping !== null);
      }
    }

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

    return updatedAvail;
  } catch (error) {
    console.error("Error:", error.message);
    return null;
  } 
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
