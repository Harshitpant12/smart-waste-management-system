import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native'; // Assuming you are using React Navigation
import axios from 'axios';
import client from '../api/client';
import AsyncStorage from '@react-native-async-storage/async-storage';

const Aws = () => {
  const navigation = useNavigation();
  const [data, setData] = useState(null);
  const [warnings, setWarnings] = useState([]);

  // Declare saveWarnings outside of loadStoredWarnings
  const saveWarnings = async (updatedWarnings) => {
    try {
      await AsyncStorage.setItem('warnings', JSON.stringify(updatedWarnings));
    } catch (error) {
      console.error('Error saving warnings:', error);
    }
  };

  useEffect(() => {
    const tryRequest = async (path = '/iot/subscribe') => {
      // Candidates for mobile requests (devtunnel, local IP, emulator alias)
      const candidates = [
        (client && client.defaults && client.defaults.baseURL) || null,
        'http://192.168.1.179:8000',
        'http://10.0.2.2:8000', // Android emulator host alias
        'http://127.0.0.1:8000',
        'http://192.168.1.179:1337',
        'http://127.0.0.1:1337',
      ].filter(Boolean);

      let lastError = null;
      let lastResponse = null;
      for (let base of candidates) {
        const isClientBase = base === client?.defaults?.baseURL;
        try {
          const target = isClientBase ? base + path : `${base}${path}`;
          console.log('Notification.tryRequest: attempting', target);
          let res;
          if (isClientBase) {
            res = await client.get(path, { validateStatus: () => true, timeout: 5000 });
          } else {
            res = await axios.get(target, { timeout: 5000, validateStatus: () => true });
          }
          console.log('Notification.tryRequest: attempt response', base, 'status', res.status);
          lastResponse = res;
          // Return immediately on 200 or other application-level status; allow 404 to be handled by the caller
          if (res.status === 200 || res.status === 404) return res;
          // for 5xx continuing to try others may be helpful, otherwise return lastResponse
          if (res.status >= 500) {
            // try next candidate if possible
            continue;
          }
          // otherwise return the response (e.g., 301 redirects etc.)
          return res;
        } catch (err) {
          lastError = err;
          console.warn('Notification.tryRequest: candidate error', base, err && err.message ? err.message : err);
          // network error, continue to try next candidate
        }
      }
      if (lastResponse) return lastResponse;
      throw lastError || new Error('No backend reachable');
    };

    const normalize = (payload) => {
      if (!payload) return null;
      const rawDistance = payload.distance ?? payload.filledLevel ?? payload.distance_cm ?? null;
      const percentSnake = payload.filled_level ?? payload.filled_level_percent ?? null;
      const percentCamel = payload.filledLevel ?? null;
      let percent = null;
      if (percentSnake !== null && percentSnake !== undefined) percent = Number(percentSnake);
      else if (percentCamel !== null && percentCamel !== undefined) percent = Number(percentCamel);
      else if (rawDistance !== null && rawDistance !== undefined) {
        // assume rawDistance is distance in cm and default height 38cm
        const h = payload.height ?? 38;
        const d = Number(rawDistance);
        if (!Number.isNaN(d)) percent = Math.round(((h - d) / h) * 100);
      }
      if (percent !== null) percent = Math.max(0, Math.min(100, percent));
      const result = { ...payload };
      // preserve any raw distance as `filledLevel` to keep compatibility with other screens
      if (rawDistance !== null && rawDistance !== undefined) result.filledLevel = Number(rawDistance);
      // add a percent property, don't overwrite existing snake-case if present
      result.filledLevelPercent = percent;
      result.rawDistance = rawDistance !== null && rawDistance !== undefined ? Number(rawDistance) : null;
      return result;
    };

    const fetchData = async () => {
      try {
        const res = await tryRequest('/iot/subscribe');
        if (!res || !res.status) return;
        if (res.status === 200) {
          const normalized = normalize(res.data);
          setData(normalized);
          // bin level check (raw distance in cm, prefer payload.rawDistance or existing filledLevel if it's raw)
          const rawVal = normalized.rawDistance ?? (normalized.filledLevel !== undefined ? Number(normalized.filledLevel) : null);
          if (rawVal !== null && rawVal !== undefined) if (rawVal < 10) showBinLevelWarning();
          if (normalized && normalized.temperature !== undefined && normalized.temperature !== null) {
            if (normalized.temperature > 30) showTemperatureWarning();
          }
        } else if (res.status === 404) {
          // no data available but request worked - don't throw; just retain previous data
          console.log('Notification.fetchData: no MQTT data yet (404)');
        }
      } catch (error) {
        console.error('Error fetching data in Notification (tryRequest):', error && error.message ? error.message : error);
      }
    };

    const loadStoredWarnings = async () => {
      try {
        const storedWarnings = await AsyncStorage.getItem('warnings');
        if (storedWarnings) {
          setWarnings(JSON.parse(storedWarnings));
        }
      } catch (error) {
        console.error('Error loading stored warnings:', error);
      }
    };

    // run once immediately, then every 5s
    fetchData();
    loadStoredWarnings();
    const interval = setInterval(() => {
      fetchData(); // Fetch data every 5 seconds
      loadStoredWarnings(); // Load stored warnings
    }, 5000);

    // Clean up function to clear the interval when the component unmounts
    return () => clearInterval(interval);
  }, []);

  const showBinLevelWarning = () => {
    console.log('Bin level warning triggered');
    const timestamp = new Date().toLocaleString();
    const warningMessage = `Bin level is less than 10 cm. (${timestamp})`;
    setWarnings((prevWarnings) => {
      const updatedWarnings = [warningMessage, ...prevWarnings];
      saveWarnings(updatedWarnings);
      return updatedWarnings;
    });
  };

  const showTemperatureWarning = () => {
    console.log('Temperature warning triggered');
    const timestamp = new Date().toLocaleString();
    const warningMessage = `Temperature is greater than 30 degrees. (${timestamp})`;
    setWarnings((prevWarnings) => {
      const updatedWarnings = [warningMessage, ...prevWarnings];
      saveWarnings(updatedWarnings);
      return updatedWarnings;
    });
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={styles.backButtonText}>Back</Text>
      </TouchableOpacity>
      <View style={styles.notificationContainer}>
        <ScrollView>
          {warnings.map((warning, index) => (
            <Text key={index} style={styles.warningText}>
              {warning}
            </Text>
          ))}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButton: {
    position: 'absolute',
    top: 40,
    left: 20,
    backgroundColor: 'teal',
    padding: 10,
    borderRadius: 5,
    zIndex: 1,
  },
  backButtonText: {
    color: 'white',
  },
  notificationContainer: {
    marginTop: 90,
    maxHeight: '80%',
    width: '80%',
    borderColor: 'rgba(0, 0, 0, 0.5)',
    borderWidth: 1,
    borderRadius: 5,
    padding: 10,
  },
  warningText: {
    fontSize: 16,
    color: 'red',
  },
});

export default Aws;