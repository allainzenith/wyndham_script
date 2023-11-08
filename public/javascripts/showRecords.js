///////////////////////////////////////////////////////////////////////////////////////////////
// FOR SHOWING RECORDS DEPENDING ON THE PAGINATION
///////////////////////////////////////////////////////////////////////////////////////////////

let updatedEventSource = null;
let searchInput = null;
let searchTimeout = null;
let paginationTimeout = null;

function createEventSource(limit, offset, endpoint, searchInput) {
    return new EventSource(`${endpoint}?limit=${limit}&offset=${offset}&search=${searchInput}`);
}

function showRecords(eventSource, tableType){
    const tableBody = document.getElementById("table-body");
    eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    tableBody.innerHTML = '';
    data.forEach(item => {
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
                    <button onclick="openLinks(this.id)" id="${item.listingID}" class="linkButton navigate">
                        ${item.listingName}
                    </button>
                </td>
                <td>${item.resortName}</td>
                <td>${item.unitType}</td>
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
                    <button onclick="openLinks(this.id)" id="${item.resort.listingID}" class="linkButton navigate">
                        ${item.resort.listingName}
                    </button>
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
    };
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

function openLinks(listingID){
    let listingIDarray = listingID.split(",");
    listingIDarray.forEach((item, index, array) => {
        array[index] = "https://app.guesty.com/properties/" + item;
    });

    if (listingIDarray.length === 1){
        const url = listingIDarray[0]; 
        window.open(url, '_blank');
    } else {
        console.log("multiple links present")
        window.open(`/duplicateListingLinks?links=${JSON.stringify(listingIDarray)}`, '_blank');
    }

}

function retry(fields){


    let resortFields = fields.split(",");
    let resortID = resortFields[1];
    let suiteType = resortFields[2];
    let months = resortFields[3];
    let execID = resortFields[4];

    // Create an XMLHttpRequest object
    var xhr = new XMLHttpRequest();

    document.getElementById(fields).style.color = '#551A8B';
    setTimeout(() => {
        document.getElementById(fields).style.color = '#000';
      }, 5000); 

    if (resortFields[0] === "DONE"){
        alert("This task is already done executing.");
    } else { 

        let endpoint = `/retry?resort_id=${resortID}&suite_type=${suiteType}&months=${months}&execID=${execID}`;
        xhr.open('GET', endpoint, true);
        xhr.send(); 

    }
}

function updateEventSource(eventSource, limit, newOffset, tableType, endpoint, searchInput) {
    if (eventSource) { eventSource.close(); }
    updatedEventSource = createEventSource(limit, newOffset, endpoint, searchInput);
    showRecords(updatedEventSource, tableType);
}


function updatePagination(eventSource, limit, offset, tableType, currentPage, records, endpoint, search) {
    // Updates the offset
    offset = limit * (currentPage - 1)
    // let currentEventSource = updatedEventSource === null ? eventSource : updatedEventSource;
    updatedEventSource = updatedEventSource === null ? eventSource : updatedEventSource;
    searchInput = searchInput === null ? search : searchInput;
    updateEventSource(updatedEventSource, limit, offset, tableType, endpoint, searchInput);

    var totalPages = Math.ceil(parseInt(records, 10) / 10); 
    var paginationElement = document.getElementById('pagination');

    // Calculate the range of pages to display
    var startPage = Math.max(1, currentPage - Math.floor(4 / 2));
    var endPage = Math.min(totalPages, startPage + 4 - 1);
    
    document.getElementById('searchString').addEventListener('input', () => {
        clearTimeout(searchTimeout);

        searchTimeout = setTimeout(() => {
            searchInput = document.getElementById('searchString').value;
            updatePagination(updatedEventSource, limit, offset, tableType, 1, records, endpoint, searchInput);
        }, 1000); 
    });
    

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
            updatePagination(updatedEventSource, limit, offset, tableType, currentPage - 1, records, endpoint, searchInput);
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
            updatePagination(updatedEventSource, limit, offset, tableType, parseInt(clickedId, 10), records, endpoint, searchInput);
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
            updatePagination(updatedEventSource, limit, offset, tableType, currentPage + 1, records, endpoint, searchInput);
        }, 300); 
    });

    paginationElement.appendChild(nextButton);
    }

    document.getElementById(currentPage).classList.add('w3-green');

}

// test function
function test(){
    console.log('hello');
}
  