<template>
  <div>
    <ion-card>
      <ion-card-header>
        <ion-card-title>Duplicate Work Entries</ion-card-title>
        <ion-card-subtitle>
          Find and delete duplicate work entries in the database.
        </ion-card-subtitle>
      </ion-card-header>
      <ion-card-content>
        <ion-button @click="fetchDuplicates" :disabled="loading">
          {{ loading ? 'Loading...' : 'Refresh' }}
        </ion-button>
        <div v-if="error" class="error">{{ error }}</div>
        <div v-if="successMsg" class="success">{{ successMsg }}</div>
        <div v-if="duplicates.length === 0 && !loading">No duplicates found.</div>
        <div v-for="(group, idx) in duplicates" :key="idx" class="duplicate-group">
          <h3>Duplicate Group {{ idx + 1 }}</h3>
          <ion-list>
            <ion-item>
              <ion-label position="stacked">Select entry to delete</ion-label>
              <ion-select v-model="group.selectedId" interface="popover" placeholder="Select entry to delete">
                <ion-select-option v-for="work in group.works" :key="work.id" :value="work.id">
                  ID: {{ work.id }} | Content: {{ work.content_id }} | Actor: {{ work.actor_id }} | Voice Actor: {{ work.voice_actor_id }}
                </ion-select-option>
              </ion-select>
            </ion-item>
          </ion-list>
          <div class="table-scroll">
            <div class="scroll-wrapper">
              <table class="scroll-table">
                <thead>
                  <tr>
                    <th class="sticky-header">ID</th>
                    <th class="sticky-header">Content ID</th>
                    <th class="sticky-header">Actor ID</th>
                    <th class="sticky-header">Voice Actor ID</th>
                    <th class="sticky-header">Status</th>
                    <th class="sticky-header">Performance</th>
                    <th class="sticky-header">Content Type</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="work in group.works" :key="work.id">
                    <td>{{ work.id }}</td>
                    <td>{{ work.content_id }}</td>
                    <td>{{ work.actor_id }}</td>
                    <td>{{ work.voice_actor_id }}</td>
                    <td>{{ work.status }}</td>
                    <td>{{ work.performance }}</td>
                    <td>{{ work.content_type }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <ion-button color="danger" expand="block" :disabled="!group.selectedId || group.deleting" @click="deleteWork(group.selectedId, idx)">
            {{ group.deleting ? 'Deleting...' : 'Delete Selected' }}
          </ion-button>
        </div>
      </ion-card-content>
    </ion-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent, IonButton, IonList, IonItem, IonLabel, IonSelect, IonSelectOption } from '@ionic/vue';
import { supabase } from '@/api/supabase';

const duplicates = ref<any[]>([]);
const loading = ref(false);
const error = ref('');
const successMsg = ref('');
// Track deleting state per group
// Use an array of booleans, indexed by group
const deleting = ref<{ [groupIdx: number]: boolean }>({});

async function fetchDuplicates() {
  loading.value = true;
  error.value = '';
  successMsg.value = '';
  duplicates.value = [];
  const { data, error: err } = await supabase.functions.invoke('find_duplicate_work');
  if (err) {
    error.value = err.message || 'Failed to fetch duplicates.';
  } else {
    // Make each group reactive so v-model works
    duplicates.value = (data || []).map((group: any) => reactive({ ...group, selectedId: null, deleting: false }));
  }
  loading.value = false;
}

async function deleteWork(workId: number, groupIdx: number) {
  if (!workId) return;
  deleting.value[groupIdx] = true;
  error.value = '';
  successMsg.value = '';
  // Call Supabase Edge Function to delete
  const { data, error: delErr } = await supabase.functions.invoke('delete_work_entry', {
    body: { id: workId },
  });
  if (delErr || (data && data.error)) {
    error.value = (delErr?.message || data?.error?.message) || 'Failed to delete work entry.';
  } else {
    successMsg.value = `Deleted work entry #${workId}`;
    // Remove the deleted row from the group in UI
    const group = duplicates.value[groupIdx];
    group.works = group.works.filter((w: any) => w.id !== workId);
    group.selectedId = null;
    // If group is now < 2, remove the group
    if (group.works.length < 2) {
      duplicates.value.splice(groupIdx, 1);
    }
    // Optionally, refresh all duplicates:
    // await fetchDuplicates();
  }
  deleting.value[groupIdx] = false;
}

// Fetch on mount
fetchDuplicates();
</script>

<style scoped>
.duplicate-work-root {
  padding-bottom: 2em;
}
.duplicate-group {
  margin-bottom: 2em;
  border: 1px solid #eee;
  padding: 1em;
  border-radius: 6px;
  box-shadow: 0 2px 8px #0001;
}
.table-scroll {
  overflow-x: auto;
  width: 100%;
  margin-bottom: 1em;
  border-radius: 6px;
  border: 1px solid #eee;
  background: #fff;
}
.scroll-wrapper {
  max-height: 300px;
  overflow-y: auto;
  min-width: 700px;
  background: #fff;
}
.sticky-header {
  position: sticky;
  top: 0;
  z-index: 2;
  background: #fff;
  box-shadow: 0 2px 2px #0001;
}
.scroll-table {
  width: 100%;
  border-collapse: collapse;
}


table {
  width: 100%;
  border-collapse: collapse;
  min-width: 700px;
}
th, td {
  border: 1px solid #ccc;
  padding: 0.4em 0.6em;
  text-align: left;
}
.delete-btn {
  margin-top: 0.5em;
  background: #e44;
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 0.4em 1em;
  cursor: pointer;
  font-weight: bold;
  transition: background 0.2s;
}
.delete-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}
.error {
  color: #c00;
  margin: 1em 0;
}
.success {
  color: #080;
  margin: 1em 0;
}
</style>
