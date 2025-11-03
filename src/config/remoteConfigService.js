import { admin } from './firebase.js';

let configCache = {};
const defaultCosts = {
  '1_5x': 100,
  '2x': 200,
  '3x': 300,
  'bronze_box_price': 5000,
  'silver_box_price': 10000,
  'gold_box_price': 20000,
};


const fetchAndCacheConfig = async (isInitial = false) => {
  try {
    const remoteConfig = admin.remoteConfig();
    const template = await remoteConfig.getTemplate();
    const newCache = {};

    Object.keys(template.parameters).forEach((key) => {
      newCache[key] = template.parameters[key].defaultValue.value;
    });

    configCache = newCache; // Atomically update the cache

    if (isInitial) {
      console.log('✅ Remote Config fetched and cached on startup.');
    } else {
      console.log('🔄 Remote Config cache REFRESHED on demand.');
    }
    console.log(`Cached prices: 1.5x=${configCache['multiplier_1_5x_price']}`);
    console.log(`Cached prices: Bronze=${configCache['bronze_box_price']}`);
    
  } catch (error) {
    console.error(`❌ Failed to ${isInitial ? 'init' : 'refresh'} Remote Config:`, error.message);
    if (isInitial) {
      console.log('Falling back to default multiplier costs.');
    }
  }
};


export const initializeRemoteConfig = async () => {
  await fetchAndCacheConfig(true);
};

export const refreshRemoteConfig = async () => {
  console.log('[Remote Config] Manual refresh signal received. Fetching config...');
  await fetchAndCacheConfig(false); // Run the fetch
};


export const getMultiplierCosts = () => {
  const price1_5x = parseInt(configCache['multiplier_1_5x_price'], 10);
  const price2x = parseInt(configCache['multiplier_2x_price'], 10);
  const price3x = parseInt(configCache['multiplier_3x_price'], 10);

  if (isNaN(price1_5x) || isNaN(price2x) || isNaN(price3x)) {
    return defaultCosts;
  }

  return {
    '1_5x': price1_5x,
    '2x': price2x,
    '3x': price3x
  };
};

export const getMysteryBoxCosts = () => {
  const bronze = parseInt(configCache['bronze_box_price'], 10);
  const silver = parseInt(configCache['silver_box_price'], 10);
  const gold = parseInt(configCache['gold_box_price'], 10);

  if (isNaN(bronze) || isNaN(silver) || isNaN(gold)) {
    return {
      'bronze': defaultCosts['bronze_box_price'],
      'silver': defaultCosts['silver_box_price'],
      'gold': defaultCosts['gold_box_price'],
    };
  }
  return { 'bronze': bronze, 'silver': silver, 'gold': gold };
};