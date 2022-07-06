// saves options to chrome.storage
const save_options = () => {
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
const restore_options = () => {
  chrome.storage.sync.get({
    optionsEnabled: false,
  }, function(items) {
    document.getElementById("options-input").checked = items.optionsEnabled;
  });
}

const getWeather = async () => {
  var lat, lon, key;

  await navigator.geolocation.getCurrentPosition((pos) => {
    lat = pos.coords.latitude;
    lon = pos.coords.longitude;
  });

  await fetch("key.txt").then((response) => {
    return response.text().then((text) => {
      key = text;
    });
  });

  let url = "https://api.openweathermap.org/data/3.0/onecall?lat=" + lat + "&lon=" + lon + "&appid=" + key;

  console.log(url);

  fetch(url).then((response) => {
    return response.text().then((text) => {
      var doc = new DOMParser().parseFromString(text, 'text/html');
        console.log(text);
    });
  });

  
}
document.addEventListener("DOMContentLoaded", getWeather);
//document.getElementById("options-input").addEventListener("click", save_options);