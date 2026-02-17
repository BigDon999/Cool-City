import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function ExtremeHeatModal({ visible, onClose, heatIndex, advice }) {
  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.alertContainer}>
        <Text style={styles.alertTitle}>EXTREME HEAT WARNING</Text>
        <Text style={styles.alertHeat}>{heatIndex}°</Text>
        <View style={styles.adviceList}>
             {Array.isArray(advice) ? advice.map((item, i) => (
                 <Text key={i} style={styles.alertText}>• {item.title}: {item.text}</Text>
             )) : <Text style={styles.alertText}>{advice}</Text>}
        </View>
        
        <TouchableOpacity
          style={styles.coolingButton}
          onPress={() => alert("Navigate to Cooling Centers")}
        >
          <Text style={{ color: "#fff", fontWeight: "bold" }}>
            Find Cooling Center
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.dismissButton}
          onPress={onClose}
        >
          <Text style={{ fontWeight: "bold" }}>Dismiss</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  alertContainer: {
    flex: 1,
    backgroundColor: "#8e44ad",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  alertTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 20,
    textAlign: "center",
  },
  alertHeat: {
    fontSize: 60,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 20,
  },
  alertText: {
    fontSize: 18,
    color: "#fff",
    textAlign: "center",
    marginBottom: 30,
    lineHeight: 24,
  },
  coolingButton: {
    backgroundColor: "#000",
    paddingVertical: 15,
    paddingHorizontal: 24,
    borderRadius: 10,
    marginBottom: 15,
  },
  dismissButton: {
    backgroundColor: "#fff",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
});
