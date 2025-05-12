// src/components/Header.tsx

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

export type HeaderProps = {
  title?: string;
  variant?: 'default' | 'transparent';
  showBack?: boolean;
  showMenu?: boolean;
  showAdd?: boolean;
  onAdd?: () => void;
  showShare?: boolean;
  onShare?: () => void;
  showNotifications?: boolean;
  onNotificationsPress?: () => void;
  showSave?: boolean;
  onSave?: () => void;
  showDarkModeToggle?: boolean;
  onToggleDarkMode?: () => void;
};

const Header: React.FC<HeaderProps> = ({
  title = 'HNNT',
  variant = 'default',
  showBack = false,
  showMenu = false,
  showAdd = false,
  onAdd,
  showShare = false,
  onShare,
  showNotifications = false,
  onNotificationsPress,
  showSave = false,
  onSave,
  showDarkModeToggle = false,
  onToggleDarkMode,
}) => {
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const backgroundStyle =
    variant === 'transparent'
      ? styles.transparent
      : isDark
      ? styles.darkBackground
      : styles.lightBackground;

  const iconColor = isDark ? '#fff' : '#000';

  return (
    <View style={[styles.container, backgroundStyle]}>
      <View style={styles.left}>  
        {showBack ? (
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
            <Ionicons name="arrow-back" size={24} color={iconColor} />
          </TouchableOpacity>
        ) : showMenu ? (
          <TouchableOpacity onPress={() => navigation.openDrawer()} style={styles.iconButton}>
            <MaterialIcons name="menu" size={24} color={iconColor} />
          </TouchableOpacity>
        ) : null}
      </View>
      <TouchableOpacity style={styles.titleContainer} onPress={() => navigation.navigate('Home') as any}>
        <Text style={[styles.title, isDark ? styles.darkText : styles.lightText]}>  
          {title}
        </Text>
      </TouchableOpacity>
      <View style={styles.right}>
        {showAdd && (
          <TouchableOpacity onPress={onAdd} style={styles.iconButton}>
            <Ionicons name="add" size={24} color={iconColor} />
          </TouchableOpacity>
        )}
        {showShare && (
          <TouchableOpacity onPress={onShare} style={styles.iconButton}>
            <Ionicons name="share-social" size={24} color={iconColor} />
          </TouchableOpacity>
        )}
        {showNotifications && (
          <TouchableOpacity onPress={onNotificationsPress} style={styles.iconButton}>
            <Ionicons name="notifications" size={24} color={iconColor} />
          </TouchableOpacity>
        )}
        {showSave && (
          <TouchableOpacity onPress={onSave} style={styles.iconButton}>
            <Ionicons name="save" size={24} color={iconColor} />
          </TouchableOpacity>
        )}
        {showDarkModeToggle && (
          <TouchableOpacity onPress={onToggleDarkMode} style={styles.iconButton}>
            <Ionicons name={isDark ? 'sunny' : 'moon'} size={24} color={iconColor} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  lightBackground: {
    backgroundColor: '#fff',
  },
  darkBackground: {
    backgroundColor: '#121212',
  },
  transparent: {
    backgroundColor: 'transparent',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  left: {
    width: 40,
    alignItems: 'flex-start',
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  lightText: {
    color: '#000',
  },
  darkText: {
    color: '#fff',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    padding: 8,
    marginLeft: 8,
  },
});

export default Header;
