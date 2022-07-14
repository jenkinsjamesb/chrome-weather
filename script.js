var info = {
  timestamp: Date.now(),
  station: "",
  location: "",
  distance: 0,
  currentTemp: "N/A",
  currentClouds: "",
  currentWeather: "",
  currentHumidity: 0,
  windSpeed: "No Data",
  forecastHourly: [],
  forecastDaily: []
};

var settings = {
  visible: false,
  useCelsius: false,
  useKilometers: false,
  customColors: {
    bg: "",
    main: "",
    accent: "",
    fringe: "",
    text: ""
  },
  stationExcludeList: [],
  cache: {}
};

// Saves options to chrome.storage
const save_options = async () => {
  var useCelsius = document.getElementById("celsius-input").checked;
  var useKilometers = document.getElementById("km-input").checked;
  var customColors = {
    bg: document.getElementById("bg-input").value,
    main: document.getElementById("main-input").value,
    accent: document.getElementById("accent-input").value,
    fringe: document.getElementById("fringe-input").value,
    text: document.getElementById("text-input").value
  };
  chrome.storage.sync.set({
    useCelsius: useCelsius,
    useKilometers: useKilometers,
    customColors: customColors
  });
}

// Restores radio button states using the preferences stored in chrome.storage.
const restore_options = async () => {
  return new Promise(resolve => {
    chrome.storage.sync.get({
      useCelsius: true,
      useKilometers: true,
      customColors: {
        bg: "",
        main: "",
        accent: "",
        fringe: "",
        text: ""
      }
    }, items => {
      settings.useCelsius = items.useCelsius;
      settings.useKilometers = items.useKilometers;
      document.getElementById("celsius-input").checked = items.useCelsius;
      document.getElementById("fahrenheit-input").checked = !items.useCelsius;
      document.getElementById("km-input").checked = items.useKilometers;
      document.getElementById("mi-input").checked = !items.useKilometers;
  
      Object.assign(settings.customColors, items.customColors);
      document.getElementById("bg-input").value = items.customColors.bg;
      document.getElementById("main-input").value = items.customColors.main;
      document.getElementById("accent-input").value = items.customColors.accent;
      document.getElementById("fringe-input").value = items.customColors.fringe;
      document.getElementById("text-input").value = items.customColors.text;
      resolve();
    });
  });
}

// General-use functions
const toTenths = (num) => Math.round(num * 10) / 10;
const cToF = (temp) => (temp - 32) * (5 / 9);
const fToC = (temp) => temp * (9 / 5) + 32;

// Function to find radar station closest to user, excluding those provided in the excludeList
const updateStation = (latUser, lonUser, stationFeatureArr, stationExcludeList = []) => {
  let nearest;
  lonUser *= (Math.PI / 180);
  latUser *= (Math.PI / 180);

  stationFeatureArr.forEach((station) => {
    let stationId = station.properties.stationIdentifier;
    let stationName = station.properties.name;
    if (stationExcludeList.includes(stationId)) return;
    
    let lonStation = station.geometry.coordinates[0] * (Math.PI / 180);
    let latStation = station.geometry.coordinates[1] * (Math.PI / 180);

    // Haversine formula
    let dLon = lonUser - lonStation;
    let dLat = latUser - latStation;
    let a = Math.pow(Math.sin(dLat / 2), 2) + Math.cos(latStation) * Math.cos(latUser) * Math.pow(Math.sin(dLon / 2),2);     
    let stationDist = 2 * Math.asin(Math.sqrt(a)) * (settings.useKilometers ? 6371:3956);
    
    if (nearest == undefined || stationDist < nearest.dist) nearest = {id: stationId, name: stationName, dist: stationDist};
  });
  info.station = nearest.id;
  info.location = nearest.name.substring(0, 32);
  info.distance = toTenths(nearest.dist) + (settings.useKilometers ? "km":"mi")
}

const parseForecastText = (text) => {
  let key = [
    ["Thunderstorms", "T-Storms"],
    ["Scattered", "Sct."],
    ["And", "&"],
    ["Slight", "S."],
    ["This ", ""],
    ["Sunday", "Sun."],
    ["Monday", "Mon."],
    ["Tuesday", "Tues."],
    ["Wednesday", "Wed."],
    ["Thursday", "Thurs."],
    ["Friday", "Fri."],
    ["Saturday", "Sat."]
  ];
  if (text.length > 12) key.forEach((swap) => text = text.replace(swap[0], swap[1]));
  return text;
}

const makeForecastDataRow = (text, classList = [], id = null) => {
  var span = document.createElement("span");
  span.innerText = text;
  if (id != null) span.id = id;
  var div = document.createElement("div");
  classList.forEach((className) => div.classList.add(className));
  div.appendChild(span);
  return div;
}

const toggleSettings = async () => {
  settings.visible = !settings.visible;
  [].forEach.call(document.getElementsByClassName("settings"), (elem) => elem.style.display = settings.visible ? "inherit":"none");
}

// Main function to send updates to the DOM
const update = async () => {
  // Header info
  document.getElementById("info-station").innerText = info.station;
  document.getElementById("info-location").innerText = info.location;
  document.getElementById("info-distance").innerText = info.distance;

  // Observation info
  document.getElementById("info-temp").innerText = info.currentTemp;
  document.getElementById("info-clouds").innerText = info.currentClouds;
  document.getElementById("info-humidity").innerText = info.currentHumidity;
  document.getElementById("info-wind").innerText = info.wind;

  // Forecasts
  info.forecastHourly.forEach((forecast) => {
    var forecastDiv = document.createElement("div");
    forecastDiv.classList.add("forecast");
    forecastDiv.appendChild(makeForecastDataRow(forecast.name, [ "centered" ]));
    forecastDiv.appendChild(makeForecastDataRow(forecast.temp, [ "centered", "temperature-text" ]));
    forecastDiv.appendChild(makeForecastDataRow(parseForecastText(forecast.text)));
    document.getElementById("forecast-hourly").appendChild(forecastDiv);
  });

  info.forecastDaily.forEach((forecast) => {
    var forecastDiv = document.createElement("div");
    forecastDiv.classList.add("forecast");
    forecastDiv.appendChild(makeForecastDataRow(parseForecastText(forecast.name), [ "centered" ]));
    forecastDiv.appendChild(makeForecastDataRow(forecast.temp, [ "centered", "temperature-text" ]));
    forecastDiv.appendChild(makeForecastDataRow(parseForecastText(forecast.text)));
    forecastDiv.setAttribute("title", forecast.tooltip);
    document.getElementById("forecast-daily").appendChild(forecastDiv);
  });
}

// Function to get basic observations from nearest operational radar station
const getObservations = async (pos, availStations, retries = 5) => {
  // Gets data from current station
  await fetch("https://api.weather.gov/stations/" + info.station + "/observations/latest")
    .then(response => response.json())
    .then(data => {
      let isCelsius = data.properties.temperature.unitCode == "wmoUnit:degC";
      let temp = data.properties.temperature.value;
      // If station outage, choose diff station
      if (temp == null || temp == undefined /*|| data.properties.textDescription == ""*/) { //see if inaccuracy is worth completeness
        settings.stationExcludeList.push(info.station);
        updateStation(pos.coords.latitude, pos.coords.longitude, availStations, settings.stationExcludeList);
        getObservations(pos, availStations);
      }

      if (settings.useCelsius) info.currentTemp = toTenths(isCelsius ? temp:cToF(temp)) + "\u00B0C";
      else info.currentTemp = toTenths(isCelsius ? fToC(temp):temp) + "\u00B0F";
      
      info.currentClouds = data.properties.textDescription;
      info.currentHumidity = data.properties.relativeHumidity.value == null ? "No Data for ":toTenths(data.properties.relativeHumidity.value);

      let windSpeed = data.properties.windSpeed.value, windDirection = data.properties.windDirection.value;
      info.wind = settings.useKilometers ? toTenths(windSpeed) + "km/h":toTenths(windSpeed * 0.621371) + "mph";
      if (windDirection != null) info.wind += " @ " + data.properties.windDirection.value + "\u00B0";
      if (windSpeed == 0 && windDirection == 0) info.wind = "Calm";
      if (windSpeed == null && windDirection == null) info.wind = "No Data";
    })
    .catch(err => {
      console.log(err);
      if (retries > 1) getObservations(pos, availStations, retries - 1);
    });
  update();
}

// Function to get hourly forecast
const getForecastHourly = async (url, retries = 5) => {
  await fetch(url)
    .then(response => response.json())
    .then(data => {
      data.properties.periods.forEach((forecast) => {
        var parsedForecast = {};
        let start = forecast.startTime, i = start.indexOf("T") + 1;
        parsedForecast.name = start.substring(i, i + 5)
        let isCelsius = forecast.temperatureUnit != "F", temp = forecast.temperature;
        
        if (settings.useCelsius) 
          parsedForecast.temp = toTenths(isCelsius ? temp:cToF(temp)) + "\u00B0C";
        else
          parsedForecast.temp = toTenths(isCelsius ? fToC(temp):temp) + "\u00B0F";

        parsedForecast.text = forecast.shortForecast;
        info.forecastHourly.push(parsedForecast);
      });
    })
    .catch(err => {
      console.log(err);
      if (retries > 1) getForecastHourly(url, retries - 1);
    });
  update();
}

// Function to get 14-day forecast
const getForecastDaily = async (url, retries = 5) => {
  await fetch(url)
    .then(response => response.json())
    .then(data => {
      data.properties.periods.forEach((forecast) => {
        var parsedForecast = {};
        parsedForecast.name = forecast.name;
        let isCelsius = forecast.temperatureUnit != "F", temp = forecast.temperature;
        
        if (settings.useCelsius) 
          parsedForecast.temp = toTenths(isCelsius ? temp:cToF(temp)) + "\u00B0C";
        else
          parsedForecast.temp = toTenths(isCelsius ? fToC(temp):temp) + "\u00B0F";

        parsedForecast.text = forecast.shortForecast;
        parsedForecast.tooltip = forecast.detailedForecast
        info.forecastDaily.push(parsedForecast);
      });
    })
    .catch(err => {
      console.log(err);
      if (retries > 1) getForecastDaily(url, retries - 1);
    });
  update();
}

const weatherCallback = async (pos) => {
  let gridUrl = "https://api.weather.gov/points/" + pos.coords.latitude + "," + pos.coords.longitude;
  let forecastUrl, gridId, gridX, gridY, availStations;

  // Fetches the user's grid point based on coords, and sets preliminary info
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
    })
    .catch(err => {
      console.log(err);
      weatherCallback(pos);
    });

  // Sets up the list of available radar stations, then sets the nearest one as the target
  await fetch("https://api.weather.gov/gridpoints/" + gridId + "/" + gridX + "," + gridY + "/stations")
    .then(response => response.json())
    .then(data => {
      availStations = data.features;
      updateStation(pos.coords.latitude, pos.coords.longitude, data.features);
    })
    .catch(err => {
      console.log(err);
      weatherCallback(pos);
    });

  // Fetches latest observations from the nearest radar station
  getObservations(pos, availStations);

  // Fetches hourly forecast
  getForecastHourly(forecastUrl + "/hourly");

  // Fetches 7-day forecast
  getForecastDaily(forecastUrl);
}

const main = async () => {
  await restore_options();
  let root = document.querySelector(":root");
  root.style.setProperty("--color-bg", settings.customColors.bg);
  root.style.setProperty("--color-main", settings.customColors.main);
  root.style.setProperty("--color-accent", settings.customColors.accent);
  root.style.setProperty("--color-fringe", settings.customColors.fringe);
  root.style.setProperty("--color-text", settings.customColors.text);
  navigator.geolocation.getCurrentPosition(weatherCallback);

  let sButton = document.getElementById("settings-toggle");
  let rButton = document.getElementById("refresh-button");
  sButton.addEventListener("click", () => {
    toggleSettings();
    if (settings.visible) {
      sButton.innerText = "Save";
      rButton.innerText = "Cancel"
      sButton.classList.add("active");
      rButton.classList.add("active");
    }
    else {
      save_options();
      sButton.innerText = "\u2699";
      rButton.innerText = "\u27f3";
      sButton.classList.remove("active");
      rButton.classList.remove("active");
      location.reload();
    }
  });

  rButton.addEventListener("click", () => {
    if (document.getElementById("refresh-button").classList.contains("active")) {
      toggleSettings();
      sButton.innerText = "\u2699";
      rButton.innerText = "\u27f3";
      sButton.classList.remove("active");
      rButton.classList.remove("active");
    } else location.reload();
  });
}
document.addEventListener("DOMContentLoaded", main);
//TODO: weather alerts, better tooltips, caching, export/import color themes?, pad bottom of forecast for scrollbar?