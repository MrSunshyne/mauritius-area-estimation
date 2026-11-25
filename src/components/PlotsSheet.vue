<script setup lang="ts">
import type { SavedPlot } from '../lib/store';
import { fmt, fmtM2, toUnits } from '../lib/units';

defineProps<{ plots: SavedPlot[] }>();
const emit = defineEmits<{ open: [plot: SavedPlot]; delete: [id: string]; close: [] }>();

function remove(p: SavedPlot) {
  if (confirm(`Delete "${p.name}"?`)) emit('delete', p.id);
}
</script>

<template>
  <div class="sheet-backdrop" @click.self="$emit('close')">
    <section class="sheet">
      <header>
        <h2>Saved plots</h2>
        <button class="close" @click="$emit('close')">Close</button>
      </header>
      <p v-if="!plots.length" class="muted">No plots yet. Draw one and press Save; it stays on this phone.</p>
      <ul class="plots">
        <li v-for="p in plots" :key="p.id">
          <button class="open" @click="$emit('open', p)">
            <strong>{{ p.name }}</strong>
            <span>{{ fmtM2(p.area) }} · {{ fmt(toUnits(p.area).perches, 1) }} perches</span>
            <small class="muted">{{ new Date(p.savedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) }}</small>
          </button>
          <button class="link danger" @click="remove(p)">Delete</button>
        </li>
      </ul>
    </section>
  </div>
</template>
