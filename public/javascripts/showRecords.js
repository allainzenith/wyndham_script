///////////////////////////////////////////////////////////////////////////////////////////////
// FOR SHOWING RECORDS DEPENDING ON THE PAGINATION
///////////////////////////////////////////////////////////////////////////////////////////////

let searchInput = null;
let searchTimeout = null;
let paginationTimeout = null;
let refreshTimeout = null;

let retryExecID;
let modalExecID;

function showRecords(ws, tableType){
    const tableBody = document.getElementById("table-body");
    ws.onmessage = (message) => {
    const data = JSON.parse(message.data).data;
    if(data.hasOwnProperty('displayModal')) {

        let modal = document.getElementById('myModal');

        const displayModal = data.displayModal;
        modalExecID = data.execID;

        if(displayModal) {
          console.log('Modal should be displayed.');
          modal.style.display = 'block';
        } else {
          console.log('Modal should not be displayed.');
          modal.style.display = 'none';
        }
    } else {
        tableBody.innerHTML = '';
        data.forEach(item => {

            let href;
            let listingID = tableType === "resorts" ? item.listingID : item.resort.listingID;
            let listingIDarray = listingID.split(",");

            listingIDarray.forEach((item, index, array) => {
                array[index] = "https://app.guesty.com/properties/" + item;
            });
        
            if (listingIDarray.length === 1){
                href = listingIDarray[0]; 
            } else {
                href = `/duplicateListingLinks?links=${listingIDarray}`;
            }

            const row = document.createElement("tr");
            if (tableType === "resorts") {
                row.innerHTML = `
                    <td>
                    <input type="checkbox" id="${item.resortRefNum}" name="checkbox[]" value="${item.resortRefNum}">
                    <button onclick="copyText(this.id)" class="linkButton copy" id="${item.resortID}" value="${item.resortID}" title="Click to copy">
                            ${item.resortID}
                        </button>
                    </td>
                    <td>
                        <a href="${href}" id="${item.listingID}" class="linkButton navigate" target="_blank">
                            ${item.listingName}
                        </a>
                    </td>
                    <td>${item.resortName}</td>
                    <td>${item.unitType}</td>
                    <td>${item.notes}</td>
                `;
            }
            else { 
                row.innerHTML = `
                    <td>
                        <button onclick="copyText(this.id)" class="linkButton copy" id="${item.resort.resortID}" value="${item.resort.resortID}" title="Click to copy">
                            ${item.resort.resortID}
                        </button>
                    </td>
                    <td>
                        <a href="${href}" id="${item.resort.listingID}" class="linkButton navigate" target="_blank">
                        ${item.resort.listingName}
                        </a>
                    </td>
                    <td>${item.resort.unitType}</td>
                    <td>${item.execStatus}</td>
                    <td>${item.monthstoScrape}</td>
                    <td>${item.createdAt}</td>
                    <td>${item.updatedAt}</td>
                    <td>
                        <button onclick="retry(this.id)" id="${item.execStatus},${item.resort.resortID},${item.resort.unitType},${item.monthstoScrape},${item.execID}" class="linkButton">
                            Retry
                        </button>
                    </td>
                `;
            }
            tableBody.appendChild(row);
        });
    }
    };
}


function updatePagination(limit, offset, tableType, currentPage, records, endpoint, search, ws, tabID) {
    // Updates the offset
    offset = limit * (currentPage - 1)
    searchInput = searchInput === null ? search : searchInput;
    ws.send(JSON.stringify({ endpoint: endpoint, limit: limit, offset: offset, search : search, tabID : tabID }));

    showRecords(ws, tableType);

    var totalPages = Math.ceil(parseInt(records, 10) / 10); 
    var paginationElement = document.getElementById('pagination');

    // Calculate the range of pages to display
    var startPage = Math.max(1, currentPage - Math.floor(4 / 2));
    var endPage = Math.min(totalPages, startPage + 4 - 1);
    
    //for search input
    document.getElementById('searchString').addEventListener('input', () => {
        clearTimeout(searchTimeout);

        searchTimeout = setTimeout(() => {
            searchInput = document.getElementById('searchString').value;
            updatePagination(limit, offset, tableType, 1, records, endpoint, searchInput, ws, tabID);
        }, 1000); 
    });
      
    const buttons = document.getElementsByName('tierButton');

    for (const button of buttons) {
        button.addEventListener('click', () => {
            clearTimeout(refreshTimeout);

            refreshTimeout = setTimeout(() => {
                updatePagination(limit, offset, tableType, currentPage, records, endpoint, searchInput, ws, tabID);
            }, 1000); 
        });
    }

    
    // Clear the existing content of paginationElement
    paginationElement.innerHTML = '';

    // Add the "Previous" button
    if (currentPage > 1) {
        var prevButton = document.createElement('button');
        prevButton.className = 'w3-button';
        prevButton.innerHTML = '&laquo;';
        prevButton.addEventListener('click', function () {
            clearTimeout(paginationTimeout);

            paginationTimeout = setTimeout(() => {
                updatePagination(limit, offset, tableType, currentPage - 1, records, endpoint, searchInput, ws, tabID);
            }, 300); 
        });

        paginationElement.appendChild(prevButton);
    }

    // Add the page links
    for (var i = startPage; i <= endPage; i++) {
        var pageButton = document.createElement('button');
        pageButton.className = 'w3-button';
        pageButton.id = i;
        pageButton.textContent = i;
        pageButton.addEventListener('click', function () {
            clearTimeout(paginationTimeout);

            paginationTimeout = setTimeout(() => {
                var clickedId = this.id;
                updatePagination(limit, offset, tableType, parseInt(clickedId, 10), records, endpoint, searchInput, ws, tabID);
            }, 300); 
        });

        paginationElement.appendChild(pageButton);
    }

    // Add the "Next" button
    if (currentPage < totalPages) {
        var nextButton = document.createElement('button');
        nextButton.className = 'w3-button';
        nextButton.innerHTML = '&raquo;';
        nextButton.addEventListener('click', function () {
            clearTimeout(paginationTimeout);

            paginationTimeout = setTimeout(() => {
                updatePagination(limit, offset, tableType, currentPage + 1, records, endpoint, searchInput, ws, tabID);
            }, 300); 
        });

        paginationElement.appendChild(nextButton);
    }

    document.getElementById(currentPage).classList.add('w3-green');

}

function copyText(itemID) {
    const copyLink = document.getElementById(itemID);
    const textToCopy = copyLink.value;

    // Create a temporary textarea element to hold the text
    const textArea = document.createElement("textarea");
    textArea.value = textToCopy;
    document.body.appendChild(textArea);

    // Select and copy the text from the textarea
    textArea.select();
    document.execCommand("copy");
    
    // Remove the temporary textarea
    document.body.removeChild(textArea);

}

function retry(fields){
    let resortFields = fields.split(",");
    let resortID = resortFields[1];
    let suiteType = resortFields[2];
    let months = resortFields[3];
    let execID = resortFields[4];

    document.getElementById(fields).style.color = '#551A8B';
    setTimeout(() => {
        document.getElementById(fields).style.color = '#000';
      }, 5000); 

    if (resortFields[0] === "DONE"){
        alert("This task is already done executing.");
    } else { 
        fetch(`/retry?resort_id=${resortID}&suite_type=${suiteType}&months=${months}&execID=${execID}`, { 
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            }
          })
          .then(response => response.json())
          .then(data => {
            const loggedIn = data.loggedIn;
            retryExecID = data.execID;

            if (loggedIn === false) {
                var modal = document.getElementById('myModal');
                modal.style.display = 'block';
                setTimeout(() => {
                if (enableInitial) {
                    document.getElementById('retry').disabled = false;
                }
                }, 60000); 
            }
          })
          .catch(error => {
            console.error('Error triggering login:', error);
          });

    }
}

async function connectToServer(environment, endpoint) {

    let ws;
    if (environment === 'production') {
        // Production environment
        ws = new WebSocket(`ws://18.220.144.108:3002/${endpoint}`);
    } else {
        // Development environment
        ws = new WebSocket(`ws://localhost:3002/${endpoint}`);
    }

    return new Promise((resolve, reject) => {
        const timer = setInterval(() => {
            if(ws.readyState === 1) {
                clearInterval(timer)
                resolve(ws);
            }
        }, 10);
    });
}

function generateUniqueString() {
    const timestamp = new Date().getTime().toString(36); 
    const randomString = Math.random().toString(36).substr(2, 8); 

    return timestamp + randomString;
  }

// test function
function test(){
    console.log('hello');
}
  