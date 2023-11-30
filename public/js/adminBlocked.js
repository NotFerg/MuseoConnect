$(function () {
    // Set up datepicker for each date input
    $(".datePicker").datepicker({
        minDate: 0, // Disable past dates
        dateFormat: 'yy-mm-dd', // Set the date format as per your needs
    });
});
//FOR BLOCKED DATES
const btnSubmitDate = document.getElementById("btnsubmitDate");

btnSubmitDate.addEventListener("click", () => {
    const datetimeInput = document.getElementById("blockedDate");
    const checkbox1030 = document.getElementById("checkbox1030");
    const checkbox1330 = document.getElementById("checkbox1330");

    const blockedDate = datetimeInput.value;
    const blockedTimes = [];

    if (checkbox1030.checked) {
        blockedTimes.push("10:30");
    }
    if (checkbox1330.checked) {
        blockedTimes.push("13:30");
    }

    const data = {
        blockedDate: blockedDate,
        blockedTimes: blockedTimes,
    };

    // Make sure data is being constructed correctly
    console.log("Data to be sent:", data);

    const blockedTimesParam = blockedTimes.join(",");

    const url = `/loggedIn/admin/addBlockedDates?blockedDate=${blockedDate}&blockedTimes=${blockedTimesParam}`;

    // Make a POST request to the server using the constructed URL
    fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(data), // Send data as JSON
    })
        .then((response) => response.json())
        .then((data) => {
            console.log("Response from server:", data);
        })
        .catch((error) => console.error("Error:", error));

    window.location.href = "/loggedInadminblocked";
});