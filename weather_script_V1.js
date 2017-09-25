/****************************
 * Change sitelinks based on weather 
 * Version 1.0
 * Created By: Martijn Kraan
 * Weather script by: AdWords Scripts Team
 * Documentation: https://developers.google.com/adwords/scripts/docs/solutions/weather-based-campaign-management#generic-weather
 * Brightstep.nl
 ****************************/

// Register for an API key at http://openweathermap.org/appid
// and enter the key below.

var OPEN_WEATHER_MAP_API_KEY = 'b4a2796e5c03d60d30295df647dba62c';

//If you want to target specific campaigns, fill the variable below with a (part of) the campaign name
//If you don't want to target specific campaigns, just leave the variable empty
var campaignNameContains = '_B_';

// Enter the location:
var weatherLocation = 'De Bilt, NL';

//Enter conditions
//See a list of conditions at openweathermap.org/weather-conditions
//If you don't want to exclude conditions, just leave the variable empty
var conditionToInclude = 'rain';
var conditionToExclude = '';

// Enter ID's of the sitelink
// You can find the ID's in the Shared Library > Business Data > Main Sitelink Feed > Item ID
var sitelinkToAdd = '16480973148';
var sitelinkToRemove = '16471484229';

// Some global variables: no need to edit enything below
var OPEN_WEATHER_MAP_SERVER_URL = 'http://api.openweathermap.org/data/2.5';
var FORECAST_ENDPOINT = OPEN_WEATHER_MAP_SERVER_URL + '/forecast/daily';
var WEATHER_ENDPOINT = OPEN_WEATHER_MAP_SERVER_URL + '/weather';

function main() {

  var nlWeather = getWeatherForLocation(weatherLocation);

  var sum = nlWeather.weather.status.description;

  Logger.log(sum + ' in ' + weatherLocation);

  var sitelink1 = AdWordsApp.extensions().sitelinks().withIds([sitelinkToAdd]).get().next();
  var sitelink2 = AdWordsApp.extensions().sitelinks().withIds([sitelinkToRemove]).get().next();

  if (conditionToExclude === '') {
    conditionToExclude = 'none';
  }

  var campaignIterator = AdWordsApp.campaigns()
    .withCondition('Status = ENABLED')
    .withCondition('AdvertisingChannelType = SEARCH')
    .withCondition('Name CONTAINS_IGNORE_CASE "' + campaignNameContains + '"')
    .get();

  while (campaignIterator.hasNext()) {
    var campaign = campaignIterator.next();

    if (sum.indexOf(conditionToInclude) >= 0 && sum.indexOf(conditionToExclude) === -1) {
      campaign.addSitelink(sitelink1);
      campaign.removeSitelink(sitelink2);
      Logger.log('Sitelink "' + sitelink1.getLinkText() + '" has been added in ' + campaign.getName() + ', Sitelink "' + sitelink2.getLinkText() + '" has been removed.')
    } else {
      campaign.removeSitelink(sitelink1);
      campaign.addSitelink(sitelink2);
      Logger.log('Sitelink "' + sitelink2.getLinkText() + '" has been added in ' + campaign.getName() + ', Sitelink "' + sitelink1.getLinkText() + '" has been removed.')
    }
  }
}

/**
 * Make a call to the OpenWeatherMap server.
 *
 * @param {string} endpoint the server endpoint.
 * @param {string} location the location for which weather
 *     information is retrieved.
 * @return {Object} the server response.
 */
function callWeatherServer(endpoint, location) {
  var url = Utilities.formatString(
    '%s?APPID=%s&q=%s',
    endpoint,
    encodeURIComponent(OPEN_WEATHER_MAP_API_KEY),
    encodeURIComponent(location));
  var response = UrlFetchApp.fetch(url);
  if (response.getResponseCode() != 200) {
    throw Utilities.formatString(
      'Error returned by API: %s, Location searched: %s.',
      response.getContentText(), location);
  }

  var result = JSON.parse(response.getContentText());

  // OpenWeatherMap's way of returning errors.
  if (result.cod != 200) {
    throw Utilities.formatString(
      'Error returned by API: %s,  Location searched: %s.',
      response.getContentText(), location);
  }
  return result;
}

/**
 * Parse the weather response from the OpenWeatherMap server.
 *
 * @param {Object} weather the weather information from
 *     OpenWeatherMap server.
 * @return {Object} the parsed weather response.
 */
function parseWeather(weather) {
  var retval = {
    'rain': 0,
    'temperature': 0,
    'windspeed': 0,
    'snow': 0,
    'clouds': 0,
    'status': {
      'id': 0,
      'summary': '',
      'description': ''
    }
  };

  if (weather.rain) {
    if (typeof weather.rain === 'object' && weather.rain['3h']) {
      retval.rain = weather.rain['3h'];
    } else {
      retval.rain = weather.rain;
    }
  }

  if (weather.snow) {
    if (typeof weather.snow === 'object' && weather.snow['3h']) {
      retval.snow = weather.snow['3h'];
    } else {
      retval.snow = weather.snow;
    }
  }

  if (weather.clouds && weather.clouds.all) {
    retval.clouds = weather.clouds.all;
  }

  if (weather.main) {
    retval.temperature = weather.main.temp.toFixed(2);
  } else if (main.temp) {
    retval.temperature = weather.temp.toFixed(2);
  }

  if (weather.wind) {
    retval.windspeed = weather.wind.speed;
  } else if (weather.speed) {
    retval.windspeed = weather.speed;
  }

  if (weather.weather && weather.weather.length > 0) {
    retval.status.id = weather.weather[0].id;
    retval.status.summary = weather.weather[0].main;
    retval.status.description = weather.weather[0].description;
  }
  return retval;
}

/**
 * Get the weather forecast for a location for the next 7 days.
 *
 * @param {string} location the location for which weather
 *     forecast information is retrieved.
 * @return {Object} the parsed weather response.
 */
function getWeatherForecastForLocation(location) {
  var result = callWeatherServer(FORECAST_ENDPOINT, location);

  var retval = {
    'name': result.city.name,
    'country': result.city.country,
    'forecast': {}
  };

  for (var i = 0; i < result.list.length; i++) {
    var forecast = result.list[i];
    var date = formatDate(forecast.dt);
    retval.forecast[date] = parseWeather(forecast);
  }

  return retval;
}

/**
 * Get the current weather information for a location.
 *
 * @param {string} location the location for which weather
 *     information is retrieved.
 * @return {Object} the parsed weather response.
 */
function getWeatherForLocation(location) {
  var result = callWeatherServer(WEATHER_ENDPOINT, location);

  var retval = {
    'name': result.name,
    'country': result.sys.country,
    'weather': parseWeather(result)
  };

  return retval;
}

/**
 * Formats the date in yyyyMMdd format.
 *
 * @param {Number} dt unix timestamp from OpenWeatherMap server.
 * @return {string} the formatted date.
 */
function formatDate(dt) {
  var date = new Date(dt * 1000);
  return Utilities.formatDate(date, 'GMT', 'yyyyMMdd');
}
