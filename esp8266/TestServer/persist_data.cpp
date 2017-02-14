#include "persist_data.h"

namespace Persist_Data {

template <typename T>
int Persistent<T>::initialised = 0;

template <typename T>
char Persistent<T>::config_version[4] = "000";

template <typename T>
Persistent<T>::Persistent(T* _p_persistent_data)
{
  p_persistent_data = _p_persistent_data;
  if(initialised == 0){
    strncpy(config_version, p_persistent_data->config_version, 4);
    EEPROM.begin(sizeof(*_p_persistent_data));
  } else {
    // TODO: allow for additional things to be saved.
  }
  ++initialised;
}


template <typename T>
int Persistent<T>::readConfig() {

  T read_data;
  for (unsigned int t = 0; t < sizeof(read_data); t++) {
    *((char*)&read_data + t) = EEPROM.read(t);
  }

  Serial.print("Expected config version: ");
  Serial.println(config_version);
  Serial.print("Found in flash: ");
  Serial.println(read_data.config_version);
  if(strncmp(config_version, read_data.config_version, 4) == 0){
    for (unsigned int t = 0; t < sizeof(*p_persistent_data); t++) {
      *((char*)p_persistent_data + t) = EEPROM.read(t);
    }
  } else {
    Serial.println("Version number in flash does not match firmware version number.");
    Serial.println("Using default values.");
  }

  return 1;
}


template <typename T>
int Persistent<T>::writeConfig() {
  int return_value = 1;
    
  for (unsigned int t = 0; t < sizeof(*p_persistent_data); t++) {
    EEPROM.write(t, *((char*)p_persistent_data + t));
    if (EEPROM.read(t) != *((char*)p_persistent_data + t)){
      Serial.print("Error writing data.");
      return_value = 0;
    }
  }
  EEPROM.commit();
  return return_value;
}

}
