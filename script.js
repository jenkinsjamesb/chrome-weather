var info = {
  station: "",
  location: "",
  currentTemp: 0,
  currentClouds: "",
  currentWeather: "",
  currentHumidity: 0,
  windSpeed: "",
  forecastHourly: [],
  forecastDaily: []
};

var settings = {
  useCelsius: false,
  useMeters: false
};

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

const toTenths = (num) => Math.round(num * 10) / 10;
const cToF = (temp) => (temp - 32) * (5 / 9);
const fToC = (temp) => temp * (9 / 5) + 32;

const update = async () => {
  document.getElementById("info-station").innerText = info.station;
  document.getElementById("info-location").innerText = info.location;
  document.getElementById("info-temp").innerText = info.currentTemp;
  document.getElementById("info-clouds").innerText = info.currentClouds;
  document.getElementById("info-humidity").innerText = info.currentHumidity;
  document.getElementById("info-wind").innerText = info.wind;
}

const weatherCallback = async (pos) => {
  let gridUrl = "https://api.weather.gov/points/" + pos.coords.latitude + "," + pos.coords.longitude;
  let forecastUrl, gridId, gridX, gridY;

  console.log(gridUrl)

  //fetches the grid point based on coords
  await fetch(gridUrl)
    .then(response => response.json())
    .then(data => {
      forecastUrl = data.properties.forecast;
      gridId = data.properties.gridId;
      gridX = data.properties.gridX;
      gridY = data.properties.gridY;
      info.station = data.properties.radarStation;
      locData = data.properties.relativeLocation.properties;
      info.location = locData.city + ", " + locData.state;
      info.location += " (" + Math.floor(locData.distance.value) + locData.distance.unitCode.replace("wmoUnit:","") + " away)";
    });

  fetch("https://api.weather.gov/gridpoints/" + gridId + "/" + gridX + "," + gridY + "/stations")
    .then(response => response.json())
    .then(data => console.log(data));
  
  //fetches latest observations from the nearest radar station
  fetch("https://api.weather.gov/stations/" + info.station + "/observations/latest")
    .then(response => response.json())
    .then(data => {
      let isCelsius = data.properties.temperature.unitCode == "wmoUnit:degC";
      let temp = data.properties.temperature.value;

      if (settings.useCelsius) 
        info.currentTemp = toTenths(isCelsius ? temp:cToF(temp)) + "\u00B0C";
      else
        info.currentTemp = toTenths(isCelsius ? fToC(temp):temp) + "\u00B0F";
      
      info.currentClouds = data.properties.textDescription;
      info.currentHumidity = toTenths(data.properties.relativeHumidity.value);

      let windSpeed = data.properties.windSpeed.value, windDirection = data.properties.windDirection.value;
      info.wind = toTenths(windSpeed) + "km/h";
      if (windDirection != null) info.wind += " @ " + data.properties.windDirection.value + "\u00B0";
      if (windSpeed == 0 && windDirection == 0) info.wind = "Calm"

      /* //parse this
      "presentWeather": [
            {
                "intensity": null,
                "modifier": null,
                "weather": "fog_mist",
                "rawString": "BR"
            }
        ],
      */

      update();
    });

  //fetches hourly forecast
  fetch(forecastUrl + "/hourly")
    .then(response => response.json())
    .then(data => {
      data.properties.periods.forEach((forecast) => {
        var parsedForecast = {};
        
        info.forecastHourly.push();
      })
    });

  //fetches 7-day forecast
  fetch(forecastUrl)
    .then(response => response.json())
    .then(data => console.log(data));

  //show windspeed/dir & station
  //TODO: weather alerts
}

const getWeather = async () => {
  navigator.geolocation.getCurrentPosition(weatherCallback);
}
document.addEventListener("DOMContentLoaded", getWeather);
//document.getElementById("options-input").addEventListener("click", save_options);