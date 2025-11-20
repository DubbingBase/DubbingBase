<template>
  <div>
    <h2>Gestion des utilisateurs</h2>
    <ion-list v-if="users.length">
      <ion-item v-for="user in users" :key="user.id">
        <ion-label>
          <div>{{ user.email }}</div>
          <div class="meta">ID: {{ user.id }}</div>
        </ion-label>
        <ion-select v-model="userRole[user.id]" @ionChange="updateRole(user)" interface="popover">
          <ion-select-option value="user">Utilisateur</ion-select-option>
          <ion-select-option value="admin">Admin</ion-select-option>
        </ion-select>
        <ion-button color="danger" @click="confirmDelete(user)">
          Supprimer
        </ion-button>
      </ion-item>
    </ion-list>
    <ion-text v-if="!users.length">Aucun utilisateur trouvé.</ion-text>

    <ion-alert
      :is-open="showConfirm"
      header="Confirmer la suppression"
      message="Êtes-vous sûr de vouloir supprimer cet utilisateur ?"
      :buttons="[
        { text: 'Annuler', role: 'cancel', handler: () => (showConfirm = false) },
        { text: 'Supprimer', role: 'destructive', handler: deleteUser }
      ]"
      @didDismiss="showConfirm = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { IonList, IonItem, IonLabel, IonSelect, IonSelectOption, IonButton, IonAlert, IonText } from '@ionic/vue';
import { supabase } from '@/api/supabase';

const users = ref<any[]>([]);
const userRole = ref<Record<string, string>>({});
const showConfirm = ref(false);
const userToDelete = ref<any>(null);

const fetchUsers = async () => {
  const session = supabase.auth.session ? supabase.auth.session() : (await supabase.auth.getSession()).data.session;
  if (!session) return;
  console.log("session", session);
  const { data, error } = await supabase.functions.invoke('list_users', {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (!error && data && data.users) {
    users.value = data.users;
    userRole.value = {};
    for (const user of data.users) {
      userRole.value[user.id] = user.app_metadata?.role || 'user';
    }
  }
};

const updateRole = async (user: any) => {
  const session = supabase.auth.session ? supabase.auth.session() : (await supabase.auth.getSession()).data.session;
  if (!session) return;
  const role = userRole.value[user.id];
  await supabase.functions.invoke('update_user_role', {
    body: { userId: user.id, role },
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  await fetchUsers();
};

const confirmDelete = (user: any) => {
  userToDelete.value = user;
  showConfirm.value = true;
};

const deleteUser = async () => {
  const session = supabase.auth.session ? supabase.auth.session() : (await supabase.auth.getSession()).data.session;
  if (!session) return;
  if (userToDelete.value) {
    await supabase.functions.invoke('delete_user', {
      body: { userId: userToDelete.value.id },
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    showConfirm.value = false;
    await fetchUsers();
  }
};

onMounted(fetchUsers);

</script>

<style scoped>
.meta {
  font-size: 0.8em;
  color: #888;
}
</style>
