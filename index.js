require('dotenv').config();
const {
  Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder,
  REST, Routes, ActionRowBuilder, ButtonBuilder, ButtonStyle
} = require('discord.js');
const fs = require('fs');
const path = require('path');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

const DATA_FILE = path.join(__dirname, 'data.json');
const CONFIG = require('./config.json');

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({
      officers: {},
      clockedIn: {},
      caseCounter: 1000,
      arrests: [],
      citations: [],
      incidents: [],
      trafficStops: [],
      warrants: [],
      pendingWarrants: {},
      bolos: [],
      accidents: [],
      evidence: []
    }, null, 2));
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function hasRole(member, roleKey) {
  const roleIds = CONFIG.roles[roleKey];
  if (!roleIds) return false;
  if (Array.isArray(roleIds)) {
    return roleIds.some(id => member.roles.cache.has(id));
  }
  return member.roles.cache.has(roleIds);
}

function isOfficer(member) {
  return hasRole(member, 'officer') || hasRole(member, 'supervisor') || hasRole(member, 'command') || hasRole(member, 'hicom') || hasRole(member, 'chief');
}

function isSupervisor(member) {
  return hasRole(member, 'supervisor') || hasRole(member, 'command') || hasRole(member, 'hicom') || hasRole(member, 'chief');
}

function isCommand(member) {
  return hasRole(member, 'command') || hasRole(member, 'hicom') || hasRole(member, 'chief');
}

function isHicom(member) {
  return hasRole(member, 'hicom') || hasRole(member, 'chief');
}

function isChief(member) {
  return hasRole(member, 'chief');
}

function isJudge(member) {
  return hasRole(member, 'judge') || hasRole(member, 'chief');
}

function getOfficerInfo(userId, data) {
  return data.officers[userId] || null;
}

function formatTime(iso) {
  return new Date(iso).toLocaleString('en-US', { timeZone: 'America/Chicago' });
}

function generateCaseNumber(data) {
  data.caseCounter += 1;
  const year = new Date().getFullYear();
  return `DPD-${year}-${data.caseCounter}`;
}

// ===================== COMMANDS =====================
const commands = [
  new SlashCommandBuilder()
    .setName('register')
    .setDescription('Register as an officer with a badge number')
    .addStringOption(o => o.setName('badge').setDescription('Your badge number').setRequired(true)),

  new SlashCommandBuilder().setName('clockin').setDescription('Clock in for duty'),
  new SlashCommandBuilder().setName('clockout').setDescription('Clock out of duty'),
  new SlashCommandBuilder().setName('status').setDescription('Check your duty status'),
  new SlashCommandBuilder().setName('active').setDescription('Show all currently clocked-in officers'),

  new SlashCommandBuilder()
    .setName('logs')
    .setDescription('View recent logs')
    .addStringOption(o => o.setName('type').setDescription('Type of log').setRequired(true)
      .addChoices(
        { name: 'Arrests', value: 'arrests' },
        { name: 'Citations', value: 'citations' },
        { name: 'Incidents', value: 'incidents' },
        { name: 'Traffic Stops', value: 'traffic' },
        { name: 'Warrants', value: 'warrants' },
        { name: 'BOLOs', value: 'bolos' },
        { name: 'Accidents', value: 'accidents' }
      ))
    .addIntegerOption(o => o.setName('limit').setDescription('How many to show (default 5)').setMinValue(1).setMaxValue(15)),

  new SlashCommandBuilder()
    .setName('case')
    .setDescription('Search for a log by case number')
    .addStringOption(o => o.setName('casenumber').setDescription('Case number (e.g. DPD-2026-1001)').setRequired(true)),

  new SlashCommandBuilder()
    .setName('arrest')
    .setDescription('Log an arrest')
    .addStringOption(o => o.setName('suspect').setDescription('Suspect name').setRequired(true))
    .addStringOption(o => o.setName('charges').setDescription('Charges').setRequired(true))
    .addStringOption(o => o.setName('location').setDescription('Location').setRequired(true))
    .addStringOption(o => o.setName('notes').setDescription('Notes').setRequired(false)),

  new SlashCommandBuilder()
    .setName('citation')
    .setDescription('Log a citation')
    .addStringOption(o => o.setName('subject').setDescription('Subject name').setRequired(true))
    .addStringOption(o => o.setName('violation').setDescription('Violation').setRequired(true))
    .addStringOption(o => o.setName('location').setDescription('Location').setRequired(true))
    .addStringOption(o => o.setName('fine').setDescription('Fine amount').setRequired(false)),

  new SlashCommandBuilder()
    .setName('incident')
    .setDescription('Log an incident report')
    .addStringOption(o => o.setName('title').setDescription('Title').setRequired(true))
    .addStringOption(o => o.setName('description').setDescription('Description').setRequired(true))
    .addStringOption(o => o.setName('location').setDescription('Location').setRequired(true))
    .addStringOption(o => o.setName('involved').setDescription('Involved parties').setRequired(false)),

  new SlashCommandBuilder()
    .setName('trafficstop')
    .setDescription('Log a traffic stop')
    .addStringOption(o => o.setName('plate').setDescription('License plate').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for stop').setRequired(true))
    .addStringOption(o => o.setName('location').setDescription('Location').setRequired(true))
    .addStringOption(o => o.setName('outcome').setDescription('Outcome').setRequired(true))
    .addStringOption(o => o.setName('driver').setDescription('Driver name').setRequired(false)),

  new SlashCommandBuilder()
    .setName('accident')
    .setDescription('Log a car accident')
    .addStringOption(o => o.setName('location').setDescription('Location of the accident').setRequired(true))
    .addStringOption(o => o.setName('vehicles').setDescription('Vehicles involved').setRequired(true))
    .addStringOption(o => o.setName('description').setDescription('What happened').setRequired(true))
    .addStringOption(o => o.setName('injuries').setDescription('Any injuries?').setRequired(true))
    .addStringOption(o => o.setName('drivers').setDescription('Drivers involved').setRequired(false))
    .addStringOption(o => o.setName('notes').setDescription('Additional notes').setRequired(false)),

  new SlashCommandBuilder()
    .setName('warrant')
    .setDescription('Request a warrant')
    .addStringOption(o => o.setName('suspect').setDescription('Suspect name').setRequired(true))
    .addStringOption(o => o.setName('charges').setDescription('Charges / Probable Cause').setRequired(true))
    .addStringOption(o => o.setName('location').setDescription('Last known location').setRequired(true))
    .addStringOption(o => o.setName('details').setDescription('Additional details').setRequired(false)),

  new SlashCommandBuilder()
    .setName('bolo')
    .setDescription('Create a BOLO')
    .addStringOption(o => o.setName('subject').setDescription('Name / Description of subject').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for BOLO').setRequired(true))
    .addStringOption(o => o.setName('lastseen').setDescription('Last known location').setRequired(true))
    .addStringOption(o => o.setName('vehicle').setDescription('Vehicle info').setRequired(false))
    .addStringOption(o => o.setName('notes').setDescription('Additional notes').setRequired(false)),

  new SlashCommandBuilder().setName('bolos').setDescription('View all active BOLOs'),

  new SlashCommandBuilder()
    .setName('clearbolo')
    .setDescription('Clear / resolve a BOLO (Supervisor+)')
    .addStringOption(o => o.setName('casenumber').setDescription('Case number of the BOLO').setRequired(true)),

  new SlashCommandBuilder()
    .setName('evidence')
    .setDescription('Attach evidence / photo to a case')
    .addStringOption(o => o.setName('casenumber').setDescription('Case number').setRequired(true))
    .addStringOption(o => o.setName('description').setDescription('Description of the evidence').setRequired(true))
    .addAttachmentOption(o => o.setName('photo').setDescription('Photo / image of the evidence').setRequired(false)),

  new SlashCommandBuilder()
    .setName('removeevidence')
    .setDescription('Remove a piece of evidence (Supervisor+)')
    .addIntegerOption(o => o.setName('evidenceid').setDescription('Evidence ID number').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for removal').setRequired(true)),

  new SlashCommandBuilder()
    .setName('void')
    .setDescription('Void a log (Supervisor+)')
    .addStringOption(o => o.setName('type').setDescription('Log type').setRequired(true)
      .addChoices(
        { name: 'Arrest', value: 'arrests' },
        { name: 'Citation', value: 'citations' },
        { name: 'Incident', value: 'incidents' },
        { name: 'Traffic Stop', value: 'trafficStops' },
        { name: 'Warrant', value: 'warrants' },
        { name: 'Accident', value: 'accidents' }
      ))
    .addStringOption(o => o.setName('casenumber').setDescription('Case number').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for voiding').setRequired(true)),

  new SlashCommandBuilder()
    .setName('editlog')
    .setDescription('Edit a field on a log (Supervisor+)')
    .addStringOption(o => o.setName('type').setDescription('Log type').setRequired(true)
      .addChoices(
        { name: 'Arrest', value: 'arrests' },
        { name: 'Citation', value: 'citations' },
        { name: 'Incident', value: 'incidents' },
        { name: 'Traffic Stop', value: 'trafficStops' },
        { name: 'Accident', value: 'accidents' }
      ))
    .addStringOption(o => o.setName('casenumber').setDescription('Case number').setRequired(true))
    .addStringOption(o => o.setName('field').setDescription('Field to edit').setRequired(true)
      .addChoices(
        { name: 'Suspect / Subject', value: 'suspect' },
        { name: 'Charges / Violation', value: 'charges' },
        { name: 'Location', value: 'location' },
        { name: 'Notes / Description', value: 'notes' },
        { name: 'Outcome', value: 'outcome' }
      ))
    .addStringOption(o => o.setName('newvalue').setDescription('New value').setRequired(true)),

  new SlashCommandBuilder()
    .setName('shiftreport')
    .setDescription('Generate a shift summary report'),
].map(c => c.toJSON());

// Register commands
const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
(async () => {
  try {
    console.log('Registering commands...');
    await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: commands });
    console.log('Commands registered successfully.');
  } catch (err) {
    console.error(err);
  }
})();

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.user.setActivity('Dallas PD Central • RP', { type: 3 });
});

// ===================== INTERACTION HANDLER =====================
client.on('interactionCreate', async interaction => {
  const data = loadData();

  // ---------- BUTTONS (Warrant flow) ----------
  if (interaction.isButton()) {
    const [action, warrantId] = interaction.customId.split('_');

    if (!data.pendingWarrants[warrantId]) {
      return interaction.reply({ content: 'This warrant request no longer exists.', ephemeral: true });
    }

    const warrant = data.pendingWarrants[warrantId];

    if (action === 'forward' && isSupervisor(interaction.member)) {
      warrant.status = 'pending_judge';
      warrant.supervisor = interaction.user.tag;
      warrant.supervisorId = interaction.user.id;
      warrant.forwardedAt = new Date().toISOString();
      saveData(data);

      const embed = new EmbedBuilder()
        .setTitle('⚖️ Warrant Pending Judicial Review')
        .setColor(0xFFA500)
        .addFields(
          { name: 'Case Number', value: warrant.caseNumber, inline: true },
          { name: 'Suspect', value: warrant.suspect, inline: true },
          { name: 'Requested By', value: `${warrant.officer} (Badge #${warrant.badge})`, inline: true },
          { name: 'Supervisor', value: warrant.supervisor, inline: true },
          { name: 'Charges / PC', value: warrant.charges },
          { name: 'Location', value: warrant.location },
          { name: 'Details', value: warrant.details || 'None' }
        )
        .setFooter({ text: `Dallas PD Central • RP • ${warrant.caseNumber}` })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`approve_${warrantId}`).setLabel('Approve Warrant').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`deny_${warrantId}`).setLabel('Deny Warrant').setStyle(ButtonStyle.Danger)
      );

      const channel = await client.channels.fetch(CONFIG.channels.warrants).catch(() => null);
      if (channel) {
        await channel.send({ content: `<@&${CONFIG.roles.judge}> New warrant requires judicial review.`, embeds: [embed], components: [row] });
      }

      await interaction.update({ content: `✅ Warrant **${warrant.caseNumber}** has been forwarded to a Judge.`, embeds: [], components: [] });
      return;
    }

    if ((action === 'approve' || action === 'deny') && isJudge(interaction.member)) {
      warrant.status = action === 'approve' ? 'approved' : 'denied';
      warrant.judge = interaction.user.tag;
      warrant.judgeId = interaction.user.id;
      warrant.decidedAt = new Date().toISOString();

      data.warrants.push({ ...warrant });
      delete data.pendingWarrants[warrantId];
      saveData(data);

      const color = action === 'approve' ? 0x00FF00 : 0xFF0000;
      const statusText = action === 'approve' ? '✅ WARRANT APPROVED' : '❌ WARRANT DENIED';

      const embed = new EmbedBuilder()
        .setTitle(statusText)
        .setColor(color)
        .addFields(
          { name: 'Case Number', value: warrant.caseNumber, inline: true },
          { name: 'Suspect', value: warrant.suspect, inline: true },
          { name: 'Requested By', value: warrant.officer, inline: true },
          { name: 'Judge', value: warrant.judge, inline: true },
          { name: 'Charges', value: warrant.charges },
          { name: 'Location', value: warrant.location }
        )
        .setFooter({ text: `Dallas PD Central • RP • ${warrant.caseNumber}` })
        .setTimestamp();

      await interaction.update({ embeds: [embed], components: [] });
      return;
    }

    return interaction.reply({ content: 'You do not have permission to perform this action.', ephemeral: true });
  }

  if (!interaction.isChatInputCommand()) return;

  const officerInfo = getOfficerInfo(interaction.user.id, data);
  const timestamp = formatTime(new Date().toISOString());

  async function postToLogChannel(channelKey, embed) {
    const channelId = CONFIG.channels[channelKey];
    if (!channelId || channelId === 'CHANNEL_ID_HERE') return;
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (channel) await channel.send({ embeds: [embed] });
  }

  // ========== REGISTER ==========
  if (interaction.commandName === 'register') {
    if (!isOfficer(interaction.member)) {
      return interaction.reply({ content: 'You must have the Officer role to register.', ephemeral: true });
    }
    const badge = interaction.options.getString('badge');
    if (data.officers[interaction.user.id]) {
      return interaction.reply({ content: `You are already registered as Badge **${data.officers[interaction.user.id].badge}**.`, ephemeral: true });
    }
    const existing = Object.values(data.officers).find(o => o.badge === badge);
    if (existing) return interaction.reply({ content: 'That badge number is already in use.', ephemeral: true });

    data.officers[interaction.user.id] = {
      badge,
      name: interaction.user.tag,
      registeredAt: new Date().toISOString()
    };
    saveData(data);
    return interaction.reply({ content: `✅ Registered as **Badge #${badge}**.`, ephemeral: true });
  }

  const requiresRegistration = ['clockin', 'clockout', 'arrest', 'citation', 'incident', 'trafficstop', 'accident', 'warrant', 'bolo', 'evidence', 'shiftreport'];
  if (requiresRegistration.includes(interaction.commandName) && !officerInfo) {
    return interaction.reply({ content: 'You must first `/register` with your badge number.', ephemeral: true });
  }

  // ========== CLOCK IN ==========
  if (interaction.commandName === 'clockin') {
    if (data.clockedIn[interaction.user.id]) {
      return interaction.reply({ content: 'You are already clocked in.', ephemeral: true });
    }
    data.clockedIn[interaction.user.id] = {
      name: interaction.user.tag,
      badge: officerInfo.badge,
      time: new Date().toISOString()
    };
    saveData(data);

    const embed = new EmbedBuilder()
      .setTitle('🟢 Clocked In')
      .setColor(0x00FF00)
      .setDescription(`**Officer:** ${interaction.user} (Badge #${officerInfo.badge})\n**Time:** ${timestamp}`)
      .setFooter({ text: 'Dallas PD Central • RP' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    await postToLogChannel('clock', embed);
  }

  // ========== CLOCK OUT ==========
  if (interaction.commandName === 'clockout') {
    if (!data.clockedIn[interaction.user.id]) {
      return interaction.reply({ content: 'You are not clocked in.', ephemeral: true });
    }
    const clockData = data.clockedIn[interaction.user.id];
    const durationMs = Date.now() - new Date(clockData.time).getTime();
    const hours = Math.floor(durationMs / 3600000);
    const minutes = Math.floor((durationMs % 3600000) / 60000);

    const shiftStart = new Date(clockData.time).getTime();
    const activity = {
      arrests: data.arrests.filter(a => a.officerId === interaction.user.id && new Date(a.time).getTime() >= shiftStart && !a.voided).length,
      citations: data.citations.filter(c => c.officerId === interaction.user.id && new Date(c.time).getTime() >= shiftStart && !c.voided).length,
      incidents: data.incidents.filter(i => i.officerId === interaction.user.id && new Date(i.time).getTime() >= shiftStart && !i.voided).length,
      traffic: data.trafficStops.filter(t => t.officerId === interaction.user.id && new Date(t.time).getTime() >= shiftStart && !t.voided).length,
      accidents: data.accidents.filter(a => a.officerId === interaction.user.id && new Date(a.time).getTime() >= shiftStart && !a.voided).length,
    };

    delete data.clockedIn[interaction.user.id];
    saveData(data);

    const embed = new EmbedBuilder()
      .setTitle('🔴 Clocked Out')
      .setColor(0xFF0000)
      .addFields(
        { name: 'Officer', value: `${interaction.user} (Badge #${officerInfo.badge})`, inline: true },
        { name: 'Duration', value: `${hours}h ${minutes}m`, inline: true },
        { name: 'Time', value: timestamp, inline: true },
        { name: 'Shift Activity', value: `Arrests: ${activity.arrests}\nCitations: ${activity.citations}\nIncidents: ${activity.incidents}\nTraffic Stops: ${activity.traffic}\nAccidents: ${activity.accidents}` }
      )
      .setFooter({ text: 'Dallas PD Central • RP' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    await postToLogChannel('clock', embed);
    await postToLogChannel('shift_reports', embed);
  }

  // ========== STATUS ==========
  if (interaction.commandName === 'status') {
    const isOn = !!data.clockedIn[interaction.user.id];
    const embed = new EmbedBuilder()
      .setTitle('Duty Status')
      .setColor(isOn ? 0x00FF00 : 0x808080)
      .setDescription(`**Officer:** ${interaction.user}${officerInfo ? ` (Badge #${officerInfo.badge})` : ''}\n**Status:** ${isOn ? 'On Duty' : 'Off Duty'}${isOn ? `\n**Since:** ${formatTime(data.clockedIn[interaction.user.id].time)}` : ''}`)
      .setFooter({ text: 'Dallas PD Central • RP' })
      .setTimestamp();
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // ========== ACTIVE ==========
  if (interaction.commandName === 'active') {
    const active = Object.entries(data.clockedIn);
    if (active.length === 0) {
      return interaction.reply({ content: 'No officers are currently clocked in.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle('🟢 Currently On Duty')
      .setColor(0x00FF00)
      .setDescription(active.map(([id, info]) => `• **${info.name}** (Badge #${info.badge}) — since ${formatTime(info.time)}`).join('\n'))
      .setFooter({ text: `Dallas PD Central • RP • ${active.length} officer(s)` })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }

  // ========== LOGS ==========
  if (interaction.commandName === 'logs') {
    const type = interaction.options.getString('type');
    const limit = interaction.options.getInteger('limit') || 5;

    const map = {
      arrests: data.arrests,
      citations: data.citations,
      incidents: data.incidents,
      traffic: data.trafficStops,
      warrants: data.warrants,
      bolos: data.bolos,
      accidents: data.accidents
    };

    let list = (map[type] || []).filter(item => !item.voided).slice(-limit).reverse();

    if (list.length === 0) {
      return interaction.reply({ content: `No active ${type} logs found.`, ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle(`Recent ${type.charAt(0).toUpperCase() + type.slice(1)}`)
      .setColor(0x1E90FF)
      .setFooter({ text: `Dallas PD Central • RP • Showing last ${list.length}` })
      .setTimestamp();

    list.forEach((item) => {
      let value = '';
      if (type === 'arrests') value = `**Suspect:** ${item.suspect}\n**Charges:** ${item.charges}\n**By:** ${item.officer}`;
      else if (type === 'citations') value = `**Subject:** ${item.subject}\n**Violation:** ${item.violation}\n**By:** ${item.officer}`;
      else if (type === 'incidents') value = `**Title:** ${item.title}\n**By:** ${item.officer}`;
      else if (type === 'traffic') value = `**Plate:** ${item.plate}\n**Reason:** ${item.reason}\n**Outcome:** ${item.outcome}\n**By:** ${item.officer}`;
      else if (type === 'warrants') value = `**Suspect:** ${item.suspect}\n**Status:** ${item.status}\n**By:** ${item.officer}`;
      else if (type === 'bolos') value = `**Subject:** ${item.subject}\n**Reason:** ${item.reason}\n**Last Seen:** ${item.lastSeen}\n**By:** ${item.officer}`;
      else if (type === 'accidents') value = `**Location:** ${item.location}\n**Vehicles:** ${item.vehicles}\n**Injuries:** ${item.injuries}\n**By:** ${item.officer}`;

      embed.addFields({ name: `${item.caseNumber || 'N/A'} • ${formatTime(item.time)}`, value });
    });

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // ========== SEARCH BY CASE NUMBER ==========
  if (interaction.commandName === 'case') {
    const caseNumber = interaction.options.getString('casenumber').toUpperCase();

    const allLogs = [
      ...data.arrests.map(l => ({ ...l, type: 'Arrest' })),
      ...data.citations.map(l => ({ ...l, type: 'Citation' })),
      ...data.incidents.map(l => ({ ...l, type: 'Incident' })),
      ...data.trafficStops.map(l => ({ ...l, type: 'Traffic Stop' })),
      ...data.warrants.map(l => ({ ...l, type: 'Warrant' })),
      ...data.bolos.map(l => ({ ...l, type: 'BOLO' })),
      ...data.accidents.map(l => ({ ...l, type: 'Accident' }))
    ];

    const log = allLogs.find(l => l.caseNumber === caseNumber);

    if (!log) {
      return interaction.reply({ content: `No log found with case number **${caseNumber}**.`, ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle(`📁 Case File — ${caseNumber}`)
      .setColor(log.voided ? 0x808080 : 0x5865F2)
      .addFields(
        { name: 'Type', value: log.type, inline: true },
        { name: 'Status', value: log.voided ? 'VOIDED' : (log.active === false ? 'Cleared' : 'Active'), inline: true },
        { name: 'Officer', value: `${log.officer} (Badge #${log.badge || 'N/A'})`, inline: true },
        { name: 'Date', value: formatTime(log.time), inline: true }
      )
      .setFooter({ text: 'Dallas PD Central • RP' })
      .setTimestamp();

    if (log.type === 'Arrest') {
      embed.addFields(
        { name: 'Suspect', value: log.suspect },
        { name: 'Charges', value: log.charges },
        { name: 'Location', value: log.location },
        { name: 'Notes', value: log.notes || 'None' }
      );
    } else if (log.type === 'Citation') {
      embed.addFields(
        { name: 'Subject', value: log.subject },
        { name: 'Violation', value: log.violation },
        { name: 'Location', value: log.location },
        { name: 'Fine', value: log.fine || 'N/A' }
      );
    } else if (log.type === 'Incident') {
      embed.addFields(
        { name: 'Title', value: log.title },
        { name: 'Description', value: log.description },
        { name: 'Location', value: log.location },
        { name: 'Involved', value: log.involved || 'None' }
      );
    } else if (log.type === 'Traffic Stop') {
      embed.addFields(
        { name: 'Plate', value: log.plate },
        { name: 'Driver', value: log.driver || 'Unknown' },
        { name: 'Reason', value: log.reason },
        { name: 'Outcome', value: log.outcome },
        { name: 'Location', value: log.location }
      );
    } else if (log.type === 'Warrant') {
      embed.addFields(
        { name: 'Suspect', value: log.suspect },
        { name: 'Charges', value: log.charges },
        { name: 'Location', value: log.location },
        { name: 'Status', value: log.status },
        { name: 'Details', value: log.details || 'None' }
      );
    } else if (log.type === 'BOLO') {
      embed.addFields(
        { name: 'Subject', value: log.subject },
        { name: 'Reason', value: log.reason },
        { name: 'Last Seen', value: log.lastSeen },
        { name: 'Vehicle', value: log.vehicle || 'None' },
        { name: 'Notes', value: log.notes || 'None' }
      );
    } else if (log.type === 'Accident') {
      embed.addFields(
        { name: 'Location', value: log.location },
        { name: 'Vehicles', value: log.vehicles },
        { name: 'Drivers', value: log.drivers || 'Unknown' },
        { name: 'Injuries', value: log.injuries },
        { name: 'Description', value: log.description },
        { name: 'Notes', value: log.notes || 'None' }
      );
    }

    if (log.voided) {
      embed.addFields(
        { name: 'Voided By', value: log.voidedBy || 'Unknown', inline: true },
        { name: 'Void Reason', value: log.voidReason || 'No reason given' }
      );
    }

    // Show attached evidence
    const relatedEvidence = data.evidence.filter(e => e.caseNumber === caseNumber && !e.removed);

    if (relatedEvidence.length > 0) {
      embed.addFields({ name: '\u200B', value: `**Attached Evidence (${relatedEvidence.length})**` });

      relatedEvidence.forEach((ev) => {
        embed.addFields({
          name: `Evidence #${ev.id} — ${formatTime(ev.time)}`,
          value: `**By:** ${ev.officer} (Badge #${ev.badge})\n**Description:** ${ev.description}${ev.imageURL ? `\n[View Image](${ev.imageURL})` : ''}`
        });
      });

      const latestWithImage = [...relatedEvidence].reverse().find(e => e.imageURL);
      if (latestWithImage) {
        embed.setImage(latestWithImage.imageURL);
      }
    } else {
      embed.addFields({ name: 'Evidence', value: 'No evidence attached to this case yet.' });
    }

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // ========== ARREST ==========
  if (interaction.commandName === 'arrest') {
    if (!isOfficer(interaction.member)) return interaction.reply({ content: 'Officers only.', ephemeral: true });

    const caseNumber = generateCaseNumber(data);
    const log = {
      id: data.arrests.length + 1,
      caseNumber,
      officer: interaction.user.tag,
      officerId: interaction.user.id,
      badge: officerInfo.badge,
      suspect: interaction.options.getString('suspect'),
      charges: interaction.options.getString('charges'),
      location: interaction.options.getString('location'),
      notes: interaction.options.getString('notes') || 'None',
      time: new Date().toISOString(),
      voided: false
    };
    data.arrests.push(log);
    saveData(data);

    const embed = new EmbedBuilder()
      .setTitle('🚔 Arrest Log')
      .setColor(0x1E90FF)
      .addFields(
        { name: 'Case Number', value: caseNumber, inline: true },
        { name: 'Officer', value: `${interaction.user} (Badge #${officerInfo.badge})`, inline: true },
        { name: 'Suspect', value: log.suspect, inline: true },
        { name: 'Location', value: log.location },
        { name: 'Charges', value: log.charges },
        { name: 'Notes', value: log.notes }
      )
      .setThumbnail(interaction.user.displayAvatarURL())
      .setFooter({ text: 'Dallas PD Central • RP' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    await postToLogChannel('arrests', embed);
  }

  // ========== CITATION ==========
  if (interaction.commandName === 'citation') {
    if (!isOfficer(interaction.member)) return interaction.reply({ content: 'Officers only.', ephemeral: true });

    const caseNumber = generateCaseNumber(data);
    const log = {
      id: data.citations.length + 1,
      caseNumber,
      officer: interaction.user.tag,
      officerId: interaction.user.id,
      badge: officerInfo.badge,
      subject: interaction.options.getString('subject'),
      violation: interaction.options.getString('violation'),
      location: interaction.options.getString('location'),
      fine: interaction.options.getString('fine') || 'N/A',
      time: new Date().toISOString(),
      voided: false
    };
    data.citations.push(log);
    saveData(data);

    const embed = new EmbedBuilder()
      .setTitle('📝 Citation Log')
      .setColor(0xFFA500)
      .addFields(
        { name: 'Case Number', value: caseNumber, inline: true },
        { name: 'Officer', value: `${interaction.user} (Badge #${officerInfo.badge})`, inline: true },
        { name: 'Subject', value: log.subject, inline: true },
        { name: 'Location', value: log.location },
        { name: 'Violation', value: log.violation },
        { name: 'Fine', value: log.fine }
      )
      .setThumbnail(interaction.user.displayAvatarURL())
      .setFooter({ text: 'Dallas PD Central • RP' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    await postToLogChannel('citations', embed);
  }

  // ========== INCIDENT ==========
  if (interaction.commandName === 'incident') {
    if (!isOfficer(interaction.member)) return interaction.reply({ content: 'Officers only.', ephemeral: true });

    const caseNumber = generateCaseNumber(data);
    const log = {
      id: data.incidents.length + 1,
      caseNumber,
      officer: interaction.user.tag,
      officerId: interaction.user.id,
      badge: officerInfo.badge,
      title: interaction.options.getString('title'),
      description: interaction.options.getString('description'),
      location: interaction.options.getString('location'),
      involved: interaction.options.getString('involved') || 'None',
      time: new Date().toISOString(),
      voided: false
    };
    data.incidents.push(log);
    saveData(data);

    const embed = new EmbedBuilder()
      .setTitle('📋 Incident Report')
      .setColor(0xDC143C)
      .addFields(
        { name: 'Case Number', value: caseNumber, inline: true },
        { name: 'Officer', value: `${interaction.user} (Badge #${officerInfo.badge})`, inline: true },
        { name: 'Location', value: log.location, inline: true },
        { name: 'Title', value: log.title },
        { name: 'Description', value: log.description },
        { name: 'Involved', value: log.involved }
      )
      .setThumbnail(interaction.user.displayAvatarURL())
      .setFooter({ text: 'Dallas PD Central • RP' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    await postToLogChannel('incidents', embed);
  }

  // ========== TRAFFIC STOP ==========
  if (interaction.commandName === 'trafficstop') {
    if (!isOfficer(interaction.member)) return interaction.reply({ content: 'Officers only.', ephemeral: true });

    const caseNumber = generateCaseNumber(data);
    const log = {
      id: data.trafficStops.length + 1,
      caseNumber,
      officer: interaction.user.tag,
      officerId: interaction.user.id,
      badge: officerInfo.badge,
      plate: interaction.options.getString('plate'),
      reason: interaction.options.getString('reason'),
      location: interaction.options.getString('location'),
      outcome: interaction.options.getString('outcome'),
      driver: interaction.options.getString('driver') || 'Unknown',
      time: new Date().toISOString(),
      voided: false
    };
    data.trafficStops.push(log);
    saveData(data);

    const embed = new EmbedBuilder()
      .setTitle('🚦 Traffic Stop')
      .setColor(0x00CED1)
      .addFields(
        { name: 'Case Number', value: caseNumber, inline: true },
        { name: 'Officer', value: `${interaction.user} (Badge #${officerInfo.badge})`, inline: true },
        { name: 'Plate', value: log.plate, inline: true },
        { name: 'Driver', value: log.driver, inline: true },
        { name: 'Location', value: log.location },
        { name: 'Reason', value: log.reason },
        { name: 'Outcome', value: log.outcome }
      )
      .setThumbnail(interaction.user.displayAvatarURL())
      .setFooter({ text: 'Dallas PD Central • RP' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    await postToLogChannel('traffic', embed);
  }

  // ========== CAR ACCIDENT ==========
  if (interaction.commandName === 'accident') {
    if (!isOfficer(interaction.member)) return interaction.reply({ content: 'Officers only.', ephemeral: true });

    const caseNumber = generateCaseNumber(data);
    const log = {
      id: data.accidents.length + 1,
      caseNumber,
      officer: interaction.user.tag,
      officerId: interaction.user.id,
      badge: officerInfo.badge,
      location: interaction.options.getString('location'),
      vehicles: interaction.options.getString('vehicles'),
      description: interaction.options.getString('description'),
      injuries: interaction.options.getString('injuries'),
      drivers: interaction.options.getString('drivers') || 'Unknown',
      notes: interaction.options.getString('notes') || 'None',
      time: new Date().toISOString(),
      voided: false
    };
    data.accidents.push(log);
    saveData(data);

    const embed = new EmbedBuilder()
      .setTitle('💥 Car Accident Report')
      .setColor(0xFF4500)
      .addFields(
        { name: 'Case Number', value: caseNumber, inline: true },
        { name: 'Officer', value: `${interaction.user} (Badge #${officerInfo.badge})`, inline: true },
        { name: 'Location', value: log.location, inline: true },
        { name: 'Vehicles Involved', value: log.vehicles },
        { name: 'Drivers', value: log.drivers },
        { name: 'Injuries', value: log.injuries },
        { name: 'Description', value: log.description },
        { name: 'Notes', value: log.notes }
      )
      .setThumbnail(interaction.user.displayAvatarURL())
      .setFooter({ text: 'Dallas PD Central • RP' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    await postToLogChannel('accidents', embed);
  }

  // ========== WARRANT ==========
  if (interaction.commandName === 'warrant') {
    if (!isOfficer(interaction.member)) return interaction.reply({ content: 'Officers only.', ephemeral: true });

    const warrantId = `W-${Date.now().toString().slice(-6)}`;
    const caseNumber = generateCaseNumber(data);

    const warrant = {
      id: warrantId,
      caseNumber,
      officer: interaction.user.tag,
      officerId: interaction.user.id,
      badge: officerInfo.badge,
      suspect: interaction.options.getString('suspect'),
      charges: interaction.options.getString('charges'),
      location: interaction.options.getString('location'),
      details: interaction.options.getString('details') || 'None',
      status: 'pending_supervisor',
      time: new Date().toISOString(),
      voided: false
    };

    data.pendingWarrants[warrantId] = warrant;
    saveData(data);

    const embed = new EmbedBuilder()
      .setTitle('📜 Warrant Request — Awaiting Supervisor')
      .setColor(0xFFD700)
      .addFields(
        { name: 'Case Number', value: caseNumber, inline: true },
        { name: 'Requested By', value: `${interaction.user} (Badge #${officerInfo.badge})`, inline: true },
        { name: 'Suspect', value: warrant.suspect, inline: true },
        { name: 'Location', value: warrant.location },
        { name: 'Charges / Probable Cause', value: warrant.charges },
        { name: 'Details', value: warrant.details }
      )
      .setFooter({ text: `Dallas PD Central • RP • ${caseNumber}` })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`forward_${warrantId}`).setLabel('Forward to Judge').setStyle(ButtonStyle.Primary)
    );

    const channel = await client.channels.fetch(CONFIG.channels.warrants).catch(() => null);
    if (channel) {
      await channel.send({
        content: `<@&${CONFIG.roles.supervisor}> New warrant request requires review.`,
        embeds: [embed],
        components: [row]
      });
    }

    await interaction.reply({ content: `✅ Warrant request **${caseNumber}** submitted and sent to Supervisors.`, ephemeral: true });
  }

  // ========== BOLO ==========
  if (interaction.commandName === 'bolo') {
    if (!isOfficer(interaction.member)) return interaction.reply({ content: 'Officers only.', ephemeral: true });

    const caseNumber = generateCaseNumber(data);
    const bolo = {
      id: data.bolos.length + 1,
      caseNumber,
      officer: interaction.user.tag,
      officerId: interaction.user.id,
      badge: officerInfo.badge,
      subject: interaction.options.getString('subject'),
      reason: interaction.options.getString('reason'),
      lastSeen: interaction.options.getString('lastseen'),
      vehicle: interaction.options.getString('vehicle') || 'None',
      notes: interaction.options.getString('notes') || 'None',
      time: new Date().toISOString(),
      active: true,
      voided: false
    };
    data.bolos.push(bolo);
    saveData(data);

    const embed = new EmbedBuilder()
      .setTitle('🚨 BOLO — Be On the Lookout')
      .setColor(0xFF0000)
      .addFields(
        { name: 'Case Number', value: caseNumber, inline: true },
        { name: 'Issued By', value: `${interaction.user} (Badge #${officerInfo.badge})`, inline: true },
        { name: 'Subject', value: bolo.subject },
        { name: 'Reason', value: bolo.reason },
        { name: 'Last Seen', value: bolo.lastSeen },
        { name: 'Vehicle', value: bolo.vehicle },
        { name: 'Notes', value: bolo.notes }
      )
      .setFooter({ text: 'Dallas PD Central • RP • ACTIVE BOLO' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    await postToLogChannel('bolos', embed);
  }

  // ========== VIEW BOLOS ==========
  if (interaction.commandName === 'bolos') {
    const activeBolos = data.bolos.filter(b => b.active && !b.voided);
    if (activeBolos.length === 0) {
      return interaction.reply({ content: 'There are currently no active BOLOs.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle('🚨 Active BOLOs')
      .setColor(0xFF0000)
      .setFooter({ text: `Dallas PD Central • RP • ${activeBolos.length} active` })
      .setTimestamp();

    activeBolos.slice(-10).reverse().forEach(b => {
      embed.addFields({
        name: `${b.caseNumber} • ${b.subject}`,
        value: `**Reason:** ${b.reason}\n**Last Seen:** ${b.lastSeen}\n**Vehicle:** ${b.vehicle}\n**Issued by:** ${b.officer}`
      });
    });

    return interaction.reply({ embeds: [embed] });
  }

  // ========== CLEAR BOLO ==========
  if (interaction.commandName === 'clearbolo') {
    if (!isSupervisor(interaction.member)) {
      return interaction.reply({ content: 'Only Supervisors and Command Staff can clear BOLOs.', ephemeral: true });
    }

    const caseNumber = interaction.options.getString('casenumber');
    const bolo = data.bolos.find(b => b.caseNumber === caseNumber && b.active && !b.voided);

    if (!bolo) {
      return interaction.reply({ content: 'No active BOLO found with that case number.', ephemeral: true });
    }

    bolo.active = false;
    bolo.clearedBy = interaction.user.tag;
    bolo.clearedAt = new Date().toISOString();
    saveData(data);

    const embed = new EmbedBuilder()
      .setTitle('✅ BOLO Cleared')
      .setColor(0x00FF00)
      .setDescription(`**Case Number:** ${caseNumber}\n**Subject:** ${bolo.subject}\n**Cleared by:** ${interaction.user}`)
      .setFooter({ text: 'Dallas PD Central • RP' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    await postToLogChannel('bolos', embed);
  }

  // ========== EVIDENCE ==========
  if (interaction.commandName === 'evidence') {
    if (!isOfficer(interaction.member)) {
      return interaction.reply({ content: 'Officers only.', ephemeral: true });
    }

    const caseNumber = interaction.options.getString('casenumber').toUpperCase();
    const description = interaction.options.getString('description');
    const photo = interaction.options.getAttachment('photo');

    const allLogs = [
      ...data.arrests,
      ...data.citations,
      ...data.incidents,
      ...data.trafficStops,
      ...data.warrants,
      ...data.bolos,
      ...data.accidents
    ];

    const caseExists = allLogs.find(l => l.caseNumber === caseNumber);
    if (!caseExists) {
      return interaction.reply({ content: `No case found with number **${caseNumber}**.`, ephemeral: true });
    }

    const evidenceEntry = {
      id: data.evidence.length + 1,
      caseNumber,
      officer: interaction.user.tag,
      officerId: interaction.user.id,
      badge: officerInfo.badge,
      description,
      imageURL: photo ? photo.url : null,
      time: new Date().toISOString(),
      removed: false
    };

    data.evidence.push(evidenceEntry);
    saveData(data);

    const embed = new EmbedBuilder()
      .setTitle('📸 Evidence Logged')
      .setColor(0x9B59B6)
      .addFields(
        { name: 'Evidence ID', value: `#${evidenceEntry.id}`, inline: true },
        { name: 'Case Number', value: caseNumber, inline: true },
        { name: 'Attached By', value: `${interaction.user} (Badge #${officerInfo.badge})`, inline: true },
        { name: 'Description', value: description }
      )
      .setFooter({ text: 'Dallas PD Central • RP' })
      .setTimestamp();

    if (photo) {
      embed.setImage(photo.url);
    }

    await interaction.reply({ embeds: [embed] });
    await postToLogChannel('evidence', embed);
  }

  // ========== REMOVE EVIDENCE ==========
  if (interaction.commandName === 'removeevidence') {
    if (!isSupervisor(interaction.member)) {
      return interaction.reply({ content: 'Only Supervisors and Command Staff can remove evidence.', ephemeral: true });
    }

    const evidenceId = interaction.options.getInteger('evidenceid');
    const reason = interaction.options.getString('reason');

    const evidence = data.evidence.find(e => e.id === evidenceId && !e.removed);

    if (!evidence) {
      return interaction.reply({ content: `No active evidence found with ID **#${evidenceId}**.`, ephemeral: true });
    }

    evidence.removed = true;
    evidence.removedBy = interaction.user.tag;
    evidence.removedAt = new Date().toISOString();
    evidence.removeReason = reason;
    saveData(data);

    const embed = new EmbedBuilder()
      .setTitle('🗑️ Evidence Removed')
      .setColor(0x808080)
      .addFields(
        { name: 'Evidence ID', value: `#${evidenceId}`, inline: true },
        { name: 'Case Number', value: evidence.caseNumber, inline: true },
        { name: 'Removed By', value: `${interaction.user}`, inline: true },
        { name: 'Original Description', value: evidence.description },
        { name: 'Reason', value: reason }
      )
      .setFooter({ text: 'Dallas PD Central • RP' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    await postToLogChannel('evidence', embed);
  }

  // ========== VOID LOG ==========
  if (interaction.commandName === 'void') {
    if (!isSupervisor(interaction.member)) {
      return interaction.reply({ content: 'Only Supervisors and Command Staff can void logs.', ephemeral: true });
    }

    const type = interaction.options.getString('type');
    const caseNumber = interaction.options.getString('casenumber');
    const reason = interaction.options.getString('reason');

    const list = data[type];
    if (!list) return interaction.reply({ content: 'Invalid log type.', ephemeral: true });

    const log = list.find(l => l.caseNumber === caseNumber && !l.voided);
    if (!log) {
      return interaction.reply({ content: 'No active log found with that case number.', ephemeral: true });
    }

    log.voided = true;
    log.voidedBy = interaction.user.tag;
    log.voidedAt = new Date().toISOString();
    log.voidReason = reason;
    saveData(data);

    const embed = new EmbedBuilder()
      .setTitle('🗑️ Log Voided')
      .setColor(0x808080)
      .addFields(
        { name: 'Case Number', value: caseNumber, inline: true },
        { name: 'Type', value: type, inline: true },
        { name: 'Voided By', value: `${interaction.user}`, inline: true },
        { name: 'Reason', value: reason }
      )
      .setFooter({ text: 'Dallas PD Central • RP' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  // ========== EDIT LOG ==========
  if (interaction.commandName === 'editlog') {
    if (!isSupervisor(interaction.member)) {
      return interaction.reply({ content: 'Only Supervisors and Command Staff can edit logs.', ephemeral: true });
    }

    const type = interaction.options.getString('type');
    const caseNumber = interaction.options.getString('casenumber');
    const field = interaction.options.getString('field');
    const newValue = interaction.options.getString('newvalue');

    const list = data[type];
    if (!list) return interaction.reply({ content: 'Invalid log type.', ephemeral: true });

    const log = list.find(l => l.caseNumber === caseNumber && !l.voided);
    if (!log) {
      return interaction.reply({ content: 'No active log found with that case number.', ephemeral: true });
    }

    const fieldMap = {
      suspect: type === 'citations' ? 'subject' : 'suspect',
      charges: type === 'citations' ? 'violation' : (type === 'incidents' ? 'description' : 'charges'),
      location: 'location',
      notes: type === 'incidents' ? 'description' : 'notes',
      outcome: 'outcome'
    };

    const actualField = fieldMap[field] || field;
    if (!(actualField in log)) {
      return interaction.reply({ content: `Field "${field}" is not valid for this log type.`, ephemeral: true });
    }

    const oldValue = log[actualField];
    log[actualField] = newValue;
    log.lastEditedBy = interaction.user.tag;
    log.lastEditedAt = new Date().toISOString();
    saveData(data);

    const embed = new EmbedBuilder()
      .setTitle('✏️ Log Edited')
      .setColor(0x5865F2)
      .addFields(
        { name: 'Case Number', value: caseNumber, inline: true },
        { name: 'Field', value: field, inline: true },
        { name: 'Edited By', value: `${interaction.user}`, inline: true },
        { name: 'Old Value', value: String(oldValue).slice(0, 1000) },
        { name: 'New Value', value: newValue.slice(0, 1000) }
      )
      .setFooter({ text: 'Dallas PD Central • RP' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  // ========== SHIFT REPORT ==========
  if (interaction.commandName === 'shiftreport') {
    const myArrests = data.arrests.filter(a => a.officerId === interaction.user.id && !a.voided);
    const myCitations = data.citations.filter(c => c.officerId === interaction.user.id && !c.voided);
    const myIncidents = data.incidents.filter(i => i.officerId === interaction.user.id && !i.voided);
    const myTraffic = data.trafficStops.filter(t => t.officerId === interaction.user.id && !t.voided);
    const myWarrants = data.warrants.filter(w => w.officerId === interaction.user.id && !w.voided);
    const myBolos = data.bolos.filter(b => b.officerId === interaction.user.id && !b.voided);
    const myAccidents = data.accidents.filter(a => a.officerId === interaction.user.id && !a.voided);

    const embed = new EmbedBuilder()
      .setTitle(`📊 Activity Report — Badge #${officerInfo.badge}`)
      .setColor(0x5865F2)
      .setDescription(`**Officer:** ${interaction.user}`)
      .addFields(
        { name: 'Arrests', value: `${myArrests.length}`, inline: true },
        { name: 'Citations', value: `${myCitations.length}`, inline: true },
        { name: 'Incidents', value: `${myIncidents.length}`, inline: true },
        { name: 'Traffic Stops', value: `${myTraffic.length}`, inline: true },
        { name: 'Warrants', value: `${myWarrants.length}`, inline: true },
        { name: 'BOLOs Issued', value: `${myBolos.length}`, inline: true },
        { name: 'Accidents', value: `${myAccidents.length}`, inline: true },
        { name: 'Currently On Duty', value: data.clockedIn[interaction.user.id] ? 'Yes' : 'No', inline: true }
      )
      .setFooter({ text: 'Dallas PD Central • RP • Lifetime Stats' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
});

client.login(process.env.TOKEN);
