////////////////////////////////////////////////////////////////////
// THIS IS A SERVICE FOR SCRAPING DATA FROM THE WYNDHAM WEBSITE
////////////////////////////////////////////////////////////////////

const path = require("path");
const { addMonths, addDays } = require("date-fns");
const { userName, passWord } = require("../config/config");
const { globals, sharedData } = require("../config/puppeteerOptions");
const { launch } = require("puppeteer");

let needtoLogin;

async function executeScraper(resortID, suiteType, months, resortHasNoRecord) {
  try {
    // console.log("I need to log in: " + needtoLogin);
    // let doneLogin = needtoLogin ? await loginVerified() : true;
    // console.log("Done login: " + doneLogin);

    let doneLogin = true;

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
    return false;
  }
}

async function login() {
  let checkToBegin = true;

  while (checkToBegin) {
    await new Promise(resolve => setTimeout(resolve, 5000));
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

    await Promise.all([
      page.waitForNavigation(), 
      page.bringToFront(),
      page.goto("https://clubwyndham.wyndhamdestinations.com/us/en/login")
    ]);

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

      let addressSelectorFound = 0;

      while (addressSelectorFound < 5) {
        try {
          await pageForAddress.waitForSelector(`.resort-card`, {
            timeout: 10000,
          });
          await pageForAddress.waitForSelector(`.resort-card__address`, {
            timeout: 10000,
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

      await checkOverlay('.onetrust-close-btn-handler[aria-label*="Close"]');

      await page.type("#okta-signin-username", userName);
      await page.type("#okta-signin-password", passWord);

      try {
        await page.waitForTimeout(5000);
        await page.waitForSelector(`.button-primary[value*="Login"]`);
        await page.click(`.button-primary[value*="Login"]`);
        console.log("form submitted")
      } catch (error) {
        console.log("Can't submit");
        console.log("Error message: ", error.message);
      }

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
    await page.waitForTimeout(5000);
    if(await page.url() === 'https://clubwyndham.wyndhamdestinations.com/us/en/owner/account') {
      console.log("No need for OTP verification");
      console.log("Logged in successfullyyyy!!");
      await page.waitForSelector(
        `.resortAvailabilityWidgetV3-title-text-color-default`,
        { timeout: 120000 }
      );
      return true;
    } else {
      console.log("Error: ", error.message);
      return null;
    }
  }
}

async function checkOverlay(overlaySelector) {
  const page = sharedData.page;

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


async function sendOTP(verOTP) {
  const page = sharedData.page;

  try {
    await page.waitForSelector('#input60', {timeout:10000});
    await page.type("#input60", verOTP);
    console.log("Inputted code");
    await page.waitForSelector('#input69', {timeout:10000});
    await page.click("#input69");
    console.log("Clicked remember device");
    await page.waitForTimeout(2000);
    await page.waitForSelector('input[type="submit"]', {timeout:10000});
    await page.click('input[type="submit"]');
    console.log("Hit submit button");

    try {
      await page.waitForTimeout(10000);
      await page.waitForSelector('#error-fragment', {timeout:10000, visible: true});
      console.log("error selector found")
      console.log("The token code is incorrect");
      return false;
    } catch (error) {
      if (await page.url() !== "https://clubwyndham.wyndhamdestinations.com/us/en/owner/account"){
        return "MAINTENANCE";
      } else {
        await page.waitForSelector(
          `.resortAvailabilityWidgetV3-title-text-color-default`,
          { timeout: 120000 }
        );
        console.log("Device verified successfully!");
        return true;
      }
    }
  } catch (error) {
    console.error("Error:", error.message);
    return null;
  } 

}

async function selectElements(resortID, suiteType) {
  const page = sharedData.page;
  await page.bringToFront();

  var calendarUrl = `https://clubwyndham.wyndhamdestinations.com/us/en/owner/resort-monthly-calendar?productId=${resortID}`;

  await page.goto(calendarUrl);

  let setupSelect = 0;
  let gotoPageAgain = false;
  while (setupSelect < 5) {
    try {
      if (gotoPageAgain) await page.goto(calendarUrl);

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
        { timeout: 60000 },
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
        let selectedSuiteType = null;
        while (selectedSuiteType !== suiteType) {
          await page.select(suiteSelector, suiteType);

          selectedSuiteType = await page.evaluate((selector) => {
            const select = document.querySelector(selector);
            const selectedOption = select.options[select.selectedIndex];
            return selectedOption.text;
          }, suiteSelector);

          console.log("This is the selected suite type:",selectedSuiteType);
        }

        const purchaseSelector = "#purchaseType";
        await page.select(purchaseSelector, "Developer");

        setupSelect = 5;
  
        return selectedOptionText;
      } else {
        console.log(
          `The option with value "${suiteType}" does not exist in the select element.`
        );
        console.log(
          `Reloading calendar page now..`
        );

        await page.reload();
        
        setupSelect++;

        if (setupSelect === 5) return null;
      }
    } catch (error) {
      console.error("Error:", error.message);
      setupSelect++;

      await page.reload();

      console.log("setupselectnow: " + setupSelect)

      // try to relaunch page for one last time
      if (setupSelect === 4) {
        let doneLogin = await login();
        console.log("logged in successfully", doneLogin);
        gotoPageAgain = true;
      }
      
      if (setupSelect === 5) return null;
    }
  }
}


async function findDateSelector(initialCurrentDate, month, day, resortID, suiteType, currentDate) {
  const page = sharedData.page;
  let findDay = 0;
  let dateElement = null;
  let dayClass = `.react-datepicker__day--0${day}[aria-label*="${month}"]`;

  while (findDay < 5) {
    try {
      dateElement = await page.waitForSelector(dayClass, {
        timeout: 10000,
      });
      await dateElement.scrollIntoView();
      findDay = 5;
    } catch (error) {
      findDay++;
      console.log("Can't find date element. Reloading again.")
      await page.reload();
      let doneSelect = await selectElements(resortID, suiteType);
      console.log("Reselected elements successfully: ", doneSelect);

      // Executed when during the scraping the date elements couldn't be found
      if(initialCurrentDate !== null) {
        initialMonthNumber = parseInt(initialCurrentDate.toLocaleDateString(undefined, { month: "2-digit" }), 10);
        monthNumber = parseInt(currentDate.toLocaleDateString(undefined, { month: "2-digit" }), 10);
      
        while (initialMonthNumber < monthNumber){
          console.log("while " + initialMonthNumber + " is less than " + monthNumber);
          const nextClass = '.react-datepicker__navigation--next[aria-label="Next Month"]';
          try {
            var nextButton = await page.waitForSelector(nextClass, {
              timeout: 10000,
            });
            await nextButton.click();
            initialMonthNumber++;
          } catch (error) {
            console.log("Can't find next button. Reloading again.")
            await page.reload();
            let doneSelect = await selectElements(resortID, suiteType);
            console.log("Reselected elements successfully: ", doneSelect);
          }

        }    
      }
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

    await findDateSelector(null, month, day, resortID, suiteType, currentDate)

    while (currentDate <= EndDate) {
      try {
        month = currentDate.toLocaleDateString(undefined, {
          month: "long",
        });
        day = currentDate.toLocaleDateString(undefined, {
          day: "2-digit",
        });

        var dateElement = await findDateSelector(initialCurrentDate, month, day, resortID, suiteType, currentDate);

        if (dateElement !== null) {

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
        }

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
                await page.waitForTimeout(2000);
              } else {
                console.log("did not find the button");
              }
              findNextButtonAttempts = 5;
            } catch (error) {
              findNextButtonAttempts++;
              console.log("Can't find next button. Reloading again.")
              await page.reload();
              let doneSelect = await selectElements(resortID, suiteType);
              console.log("Reselected elements successfully: ", doneSelect)
            }
          }
        }
      } catch (error) {
        console.error("Error:", error.message);
        console.log("Day class not found");
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
  } finally {
    await page.waitForTimeout(2000);
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
          { timeout: 120000 }
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
  login
};
