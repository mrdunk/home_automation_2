#ifndef ESP8266__PERSIST_DATA__H
#define ESP8266__PERSIST_DATA__H


namespace Persist_Data {

  template <typename T>
  class Persistent {
    private:
      T* p_persistent_data;
      static int initialised;
      static char config_version[4];
    public:
      Persistent(char const* _config_version, T* _p_persistent_data);
      int readConfig();
      int writeConfig();
  };

}

#endif  // ESP8266__PERSIST_DATA__H
