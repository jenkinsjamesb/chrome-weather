// saves options to chrome.storage
function save_options() {
  var bool = document.getElementById("options-input").checked;
  chrome.storage.sync.set({
    optionsEnabled: bool,
  }, function() {
    var status = document.getElementById('status');
    status.textContent = 'Saved.';
    setTimeout(function() {
      status.textContent = '';
    }, 1500);
  });
}

// restores select box and checkbox state using the preferences stored in chrome.storage.
function restore_options() {
  chrome.storage.sync.get({
    optionsEnabled: false,
  }, function(items) {
    document.getElementById("options-input").checked = items.optionsEnabled;
  });
}

function getWeather() {
  navigator.geolocation.getCurrentPosition((pos) => {
    var lat = pos.coords.latitude;
    var lon = pos.coords.longitude;
    console.log(lat + "," + lon);

    let url = "https://forecast.weather.gov/MapClick.php?lat=" + lat + "&lon=" + lon + "*/"
    fetch(url).then((response) => {
      return response.text().then((text) => {
        var doc = new DOMParser().parseFromString(text, 'text/html');
          console.log(doc.querySelector(".myforecast-current"));
      });
    });
  });
}
document.addEventListener("DOMContentLoaded", getWeather);
//document.getElementById("options-input").addEventListener("click", save_options);