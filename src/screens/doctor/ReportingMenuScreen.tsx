import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const PRIMARY = '#0D9488';

const menuItems = [
  {
    id: 'ResultEntry',
    title: 'View Result / Report',
    icon: 'file-document-check-outline',
    desc: 'Search, view patient results, and download PDF reports.',
    screen: 'TestResultEntry'
  },
  {
    id: 'AddResultParam',
    title: 'Add Result With TestParam',
    icon: 'text-box-plus-outline',
    desc: 'Enter detailed parameter values for specific tests.',
    screen: 'AddResultWithTestParam'
  },
  {
    id: 'TATPatientWise',
    title: 'TAT Patient Wise',
    icon: 'clock-check-outline',
    desc: 'Track Turnaround Time (TAT) details per patient.',
    screen: 'TATPatientWise'
  }
];

export default function ReportingMenuScreen({ navigation }: any) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Reporting</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {menuItems.map(item => (
          <TouchableOpacity 
            key={item.id}
            style={styles.card}
            onPress={() => navigation.navigate(item.screen)}
          >
            <View style={[styles.iconContainer, { backgroundColor: '#F0FDFA' }]}>
              <MaterialCommunityIcons name={item.icon as any} size={28} color={PRIMARY} />
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardDesc}>{item.desc}</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color="#CBD5E1" />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#0F172A' },
  content: { padding: 20 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#1E293B', marginBottom: 4 },
  cardDesc: { fontSize: 13, color: '#64748B', lineHeight: 18 },
});
