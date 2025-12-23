import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  Keyboard,
  ScrollView,
  TextInput,
  TouchableWithoutFeedback,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image

} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AntDesign } from 'react-native-vector-icons';
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from 'expo-image-picker';


import client from "../api/client";

const ReportScreen = ({ navigation }) => {
  const [name, changeName] = useState("");
  const [number, changeNumber] = useState("");
  const [title, changeTitle] = useState("");
  const [feedback, changeFeedback] = useState("");
  const [error, setError] = useState("");

  // image state for attached photo
  const [image, setImage] = useState(null);

  const [isLoading, setIsLoading] = useState(false);

  if (isLoading) {
    return (
      <View style={[{ flex: 1 }, { justifyContent: 'center' }, { alignItems: 'center' }, { zIndex: 1 }]}>
        <ActivityIndicator size='large' />
      </View>
    )
  }

  // const [email, setUserEmail] = useState('');

  // useEffect(() => {
  //   const fetchUserEmail = async () => {
  //     const email = await AsyncStorage.getItem('email');
  //     setUserEmail(email);
  //   };


  //   fetchUserEmail();
  // }, []);


  const updateError = (error, stateUpdater) => {
    stateUpdater(error);
    setTimeout(() => {
      stateUpdater("");
    }, 2500);
  };

  const handleTouchablePress = () => {
    Keyboard.dismiss();
  };

  const handleNavigation = () => {
    navigation.goBack();
  };

  const isValidNumber = (number) => {
    const regex = /^[6-9]\d{9}$/;
    return regex.test(number);
  };

  // pick image from device (expo-image-picker)
  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Permission to access media library is required to attach photos.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
      });
      if (!result.cancelled) {
        setImage(result);
      }
    } catch (e) {
      console.warn('Image pick failed', e && e.message ? e.message : e);
      Alert.alert('Error', 'Could not pick image');
    }
  };

  const removeImage = () => setImage(null);

  const handleSubmit = async () => {
    setIsLoading(true);
    if (!name.trim() || !number.trim() || !title.trim() || !feedback.trim()) {
      setIsLoading(false);
      return updateError("Fill all the fields!", setError);
    }

    // Validate mobile number
    if (!isValidNumber(number)) {
      setIsLoading(false);
      return updateError("Invalid mobile number!", setError);
    }

    try {
      // If an image is attached, send multipart/form-data
      if (image && image.uri) {
        const formData = new FormData();
        formData.append('name', name);
        formData.append('number', number);
        formData.append('title', title);
        formData.append('feedback', feedback);
        // mark source as mobile
        formData.append('source', 'mobile');

        const uri = image.uri;
        const filename = uri.split('/').pop();
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image';

        formData.append('photo', { uri, name: filename, type });

        await client.post('/report-user', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        }).then(res => {
          if (res.data.status) {
            setIsLoading(false);
            setImage(null);
            Alert.alert("Done", res.data.message, [
              {
                text: 'Ok',
                onPress: () => { navigation.navigate('PublicHomeScreen'); }
              }
            ]);
          } else {
            setIsLoading(false);
            Alert.alert(res.data.message || 'Failed to submit');
          }
        });

      } else {
        // No image; send JSON payload
        await client
          .post('/report-user', {
            name,
            number,
            title,
            feedback,
          })
          .then(res => {
            console.log(res.data);
            if (res.data.status) {
              setIsLoading(false);
              Alert.alert("Done", res.data.message, [
                {
                  text: 'Ok',
                  onPress: () => { navigation.navigate('PublicHomeScreen'); }
                }
              ]);
            }
            else {
              setIsLoading(false);
              Alert.alert(res.data.message);
            }
          })
      }

    } catch (error) {
      //Handle error
      setIsLoading(false);
      console.error('Error reporting', error && error.message ? error.message : error);
      Alert.alert('Error', 'Failed to submit report');
    }
  };



  return (
    <SafeAreaView>
      <ScrollView>
        <TouchableWithoutFeedback onPress={handleTouchablePress}>
          <View style={styles.container}>
            <TouchableOpacity onPress={handleNavigation} style={styles.icon} >
              <AntDesign name="left" size={30} color="teal" />
            </TouchableOpacity>
            <Text style={styles.headingText}>
              You can make your Complaints or Feedbacks here
            </Text>
            {error ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : null}
            <View>
              <View style={styles.textboxContainer}>
                <Text style={styles.textboxHeader}>Name</Text>
                <TextInput
                  style={styles.input}
                  onChangeText={(text) => changeName(text)}
                  value={name}
                  placeholder="Ex: Perera"
                  selectionColor={"teal"}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.textboxContainer}>
                <Text style={styles.textboxHeader}>Contact number</Text>
                <TextInput
                  style={styles.input}
                  onChangeText={(text) => changeNumber(text)}
                  value={number}
                  placeholder="Ex: 0781234567"
                  selectionColor={"teal"}
                  textAlignVertical="top"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.textboxContainer}>
                <Text style={styles.textboxHeader}>Topic</Text>
                <TextInput
                  style={styles.input}
                  onChangeText={(text) => changeTitle(text)}
                  value={title}
                  placeholder="Write the topic of complaint/feedback here"
                  autoCorrect={true}
                  selectionColor={"teal"}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.textboxContainer}>
                <Text style={styles.textboxHeader}>Feedback</Text>
                <TextInput
                  style={[styles.input, { height: 200 }]}
                  onChangeText={(text) => changeFeedback(text)}
                  value={feedback}
                  placeholder="Write a descriptive complaint/feedback here"
                  multiline
                  autoCorrect={true}
                  selectionColor={"teal"}
                  textAlignVertical="top"
                />
              </View>

              {/* Photo attachment UI */}
              <View style={{ alignItems: 'center', marginTop: 8 }}>
                <TouchableOpacity onPress={pickImage} style={styles.attachBtn} activeOpacity={0.8}>
                  <Text style={styles.attachBtnText}>{image ? 'Change Photo' : 'Attach Photo'}</Text>
                </TouchableOpacity>
                {image ? (
                  <View style={{ alignItems: 'center', marginTop: 8 }}>
                    <Image source={{ uri: image.uri }} style={{ width: 260, height: 160, borderRadius: 8 }} />
                    <TouchableOpacity onPress={removeImage} style={styles.removeBtn} activeOpacity={0.8}>
                      <Text style={styles.removeBtnText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            </View>

            <TouchableOpacity onPress={handleSubmit} style={styles.buttonContainer} activeOpacity={0.7} >
              <Text style={styles.button}>Submit</Text>
            </TouchableOpacity>
          </View>
        </TouchableWithoutFeedback>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ReportScreen;

const styles = StyleSheet.create({
  container: {
    flexDirection: "column",
    alignItems: "center",
    margin: 5,
  },
  icon: {
    alignSelf: 'flex-start',
    paddingLeft: 10,
    paddingTop: 20
  },
  headingText: {
    fontSize: 25,
    fontWeight: "bold",
    color: "teal",
    marginTop: 5,
    marginBottom: 20,
    textAlign: "center",
  },
  errorText: {
    color: "red",
    textAlign: "center",
  },
  textboxHeader: {
    fontSize: 20,
    fontWeight: "400",
    color: "teal",
  },
  textboxContainer: {
    flexDirection: "column",
    justifyContent: "space-evenly",
    marginBottom: 5,
  },
  input: {
    width: 350,
    borderWidth: 0.8,
    borderRadius: 4,
    borderColor: "teal",
    fontSize: 15,
    paddingLeft: 4,
    height: 50,
  },
  buttonContainer: {
    height: 50,
    width: 200,
    backgroundColor: "teal",
    borderRadius: 30,
    borderWidth: 2,
    borderColor: "#265b82ff",
    marginLeft: "auto",
    marginRight: "auto",
    marginTop: 10,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowOffset: {
      width: 100,
      height: 100
    },

    shadowColor: '#20476b',
    shadowOpacity: 1,
    shadowRadius: 108
  },
  button: {
    textAlign: "center",
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
    lineHeight: 40,
  },
  attachBtn: {
    height: 40,
    width: 160,
    backgroundColor: "#2b8f87",
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  attachBtnText: { color: '#fff', fontWeight: 'bold' },
  removeBtn: { marginTop: 8, backgroundColor: '#ff4d4f', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  removeBtnText: { color: '#fff' },
});
