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
                <td>${item.resortID}</td>
                <td onclick="openLinks(this.id)" id="${item.listingID}" class="listingName">${item.listingName}</td>
                <td>${item.resortName}</td>
                <td>${item.unitType}</td>
            `;
        }
        else { 
            row.innerHTML = `
                <td>${item.resort.resortID}</td>
                <td>${item.resort.listingName}</td>
                <td>${item.resort.unitType}</td>
                <td>${item.execStatus}</td>
                <td>${item.monthstoScrape}</td>
                <td>${item.createdAt}</td>
                <td>${item.updatedAt}</td>
            `;
        }
        tableBody.appendChild(row);
    });
    };
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