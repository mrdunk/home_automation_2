#include "Arduino.h"
#include <EEPROM.h>

#include "persist_data.h"

namespace Persist_Data {

template <typename T>
int Persistent<T>::initialised = 0;

template <typename T>
char Persistent<T>::version_of_program[4] = "000";

template <typename T>
Persistent<T>::Persistent(char const* _version_of_program, T* _p_persistent_data)
{
  p_persistent_data = _p_persistent_data;
  if(initialised == 0){
    strncpy(version_of_program, _version_of_program, 4);
    EEPROM.begin(sizeof(*_p_persistent_data));
  } else {
    // TODO: allow for additional things to be saved.
  }
  ++initialised;
}


template <typename T>
int Persistent<T>::readConfig() {
  if (EEPROM.read(sizeof(*p_persistent_data) - 1) == p_persistent_data->version_of_program[3] && // this is '\0'
      EEPROM.read(sizeof(*p_persistent_data) - 2) == p_persistent_data->version_of_program[2] &&
      EEPROM.read(sizeof(*p_persistent_data) - 3) == p_persistent_data->version_of_program[1] &&
      EEPROM.read(sizeof(*p_persistent_data) - 4) == p_persistent_data->version_of_program[0]) {
    // version matches.
    for (unsigned int t = 0; t < sizeof(*p_persistent_data); t++) {
      *((char*)p_persistent_data + t) = EEPROM.read(t);
    }
  } else {
    Serial.println("");
    Serial.print("Invalid config version:");
    Serial.println(p_persistent_data->version_of_program);
    Serial.println("Using defaults.");
    return 0;
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
