///////////////////////////////////////////////////////////////////////////////////////////////
// FOR SHOWING RECORDS DEPENDING ON THE PAGINATION
///////////////////////////////////////////////////////////////////////////////////////////////

let updatedEventSource = null;

function createEventSource(limit, offset, endpoint) {
    return new EventSource(`${endpoint}?limit=${limit}&offset=${offset}`);
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

function updateEventSource(eventSource, limit, newOffset, tableType, endpoint) {
    if (eventSource) { eventSource.close(); }
    updatedEventSource = createEventSource(limit, newOffset, endpoint);
    showRecords(updatedEventSource, tableType);
}


function updatePagination(eventSource, limit, offset, tableType, currentPage, records, endpoint) {
    // Updates the offset
    offset = limit * (currentPage - 1)
    let currentEventSource = updatedEventSource === null ? eventSource : updatedEventSource;
    updateEventSource(currentEventSource, limit, offset, tableType, endpoint);

    //- var records = !{JSON.stringify(records)};
    var totalPages = Math.ceil(parseInt(records, 10) / 10); 
    var pagesToShow = 4;
    var paginationElement = document.getElementById('pagination');

    // Clear the existing content of paginationElement
    paginationElement.innerHTML = '';

    // Add the "Previous" button
    if (currentPage > 1) {
    var prevButton = document.createElement('button');
    prevButton.className = 'w3-button';
    prevButton.innerHTML = '&laquo;';
    prevButton.addEventListener('click', function () {
        updatePagination(currentEventSource, limit, offset, tableType, currentPage - 1, records, endpoint);
    });
    paginationElement.appendChild(prevButton);
    }

    // Calculate the range of pages to display
    var startPage = Math.max(1, currentPage - Math.floor(pagesToShow / 2));
    var endPage = Math.min(totalPages, startPage + pagesToShow - 1);

    // Add the page links
    for (var i = startPage; i <= endPage; i++) {
    var pageButton = document.createElement('button');
    pageButton.className = 'w3-button';
    pageButton.id = i;
    pageButton.textContent = i;
    pageButton.addEventListener('click', function() {
        var clickedId = this.id;
        updatePagination(currentEventSource, limit, offset, tableType, parseInt(clickedId, 10), records, endpoint);
    });
    paginationElement.appendChild(pageButton);
    }

    // Add the "Next" button
    if (currentPage < totalPages) {
    var nextButton = document.createElement('button');
    nextButton.className = 'w3-button';
    nextButton.innerHTML = '&raquo;';
    nextButton.addEventListener('click', function () {
        updatePagination(currentEventSource, limit, offset, tableType, currentPage + 1, records, endpoint);
    });
    paginationElement.appendChild(nextButton);
    }

    document.getElementById(currentPage).classList.add('w3-green');

}


// test function
function test(){
    console.log('This is a test');
}