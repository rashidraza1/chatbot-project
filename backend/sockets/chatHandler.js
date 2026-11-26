const { Conversation, Message, Bot, Visitor, User } = require('../models');
const { generateBotResponse } = require('../services/openaiService');
const { searchRelevantChunks } = require('../services/pdfService');

module.exports = (io, socket) => {
  console.log('New client connected:', socket.id);

  // Visitor joins a room based on conversation ID
  socket.on('join_conversation', async (payload) => {
    try {
      const conversationId = typeof payload === 'object' && payload !== null
        ? (payload.conversationId || payload.conversation_id || payload.id)
        : payload;
      const botId = typeof payload === 'object' && payload !== null ? payload.botId : null;
      const visitorData = typeof payload === 'object' && payload !== null ? payload.visitorData : null;

      let conversation;

      if (conversationId) {
        conversation = await Conversation.findByPk(conversationId, { include: [Bot, Visitor] });
        if (conversation) {
          socket.join(`conversation_${conversation.id}`);
          socket.emit('conversation_joined', { conversation });
          return;
        }
      }

      if (!botId) {
        console.warn('join_conversation skipped: botId is required when no valid conversationId is provided');
        return;
      }

      // Fetch the bot with FAQs
      const bot = await Bot.findByPk(botId);
      if (!bot) {
        console.warn(`join_conversation: Bot with id ${botId} not found`);
        return;
      }

      // If no conversation exists, find or create visitor
      let visitor = null;
      if (visitorData?.id) {
        visitor = await Visitor.findByPk(visitorData.id);
      }
      if (!visitor && visitorData?.email) {
        visitor = await Visitor.findOne({ where: { email: visitorData.email }, order: [['id', 'DESC']] });
      }
      if (!visitor && (visitorData?.phone || visitorData?.mobile)) {
        visitor = await Visitor.findOne({ where: { phone: visitorData.phone || visitorData.mobile }, order: [['id', 'DESC']] });
      }

      if (!visitor) {
        visitor = await Visitor.create({
          name: visitorData?.name || 'Anonymous',
          email: visitorData?.email || null,
          phone: visitorData?.phone || visitorData?.mobile || null,
          last_page_url: visitorData?.url || null,
          last_seen: new Date()
        });
      } else {
        await visitor.update({
          ...(visitorData?.name ? { name: visitorData.name } : {}),
          ...(visitorData?.email ? { email: visitorData.email } : {}),
          ...(visitorData?.phone || visitorData?.mobile ? { phone: visitorData.phone || visitorData.mobile } : {}),
          last_seen: new Date()
        });
      }

      conversation = await Conversation.create({
        bot_id: botId,
        visitor_id: visitor.id,
        status: 'active'
      });

      socket.join(`conversation_${conversation.id}`);
      socket.emit('conversation_joined', { conversation, bot });
      
      // Auto-send welcome message
      if (bot.welcome_message) {
        const welcomeMessage = await Message.create({
          conversation_id: conversation.id,
          sender_type: 'bot',
          content: bot.welcome_message
        });
        io.to(`conversation_${conversation.id}`).emit('new_message', welcomeMessage);
      }
    } catch (error) {
       console.error('Error joining conversation', error);
    }
  });

  // Handle incoming messages from visitor
  socket.on('send_message', async ({ conversationId, content, senderType, senderId }) => {
    console.log(`Message received: ${content} from ${senderType} in conv ${conversationId}`);
    try {
      const message = await Message.create({
        conversation_id: conversationId,
        sender_type: senderType,
        sender_id: senderId || null,
        content
      });

      // Touch conversation to update updatedAt
      await Conversation.update({ updatedAt: new Date() }, { where: { id: conversationId } });

      console.log('Message saved to DB, broadcasting to room:', `conversation_${conversationId}`);
      io.to(`conversation_${conversationId}`).emit('new_message', message);

      const conversation = await Conversation.findByPk(conversationId, { include: [Bot] });
      if (!conversation) {
        console.error(`Conversation ${conversationId} not found!`);
        return;
      }

      // If the sender is a visitor and the status is active, the bot should auto-reply
      if (senderType === 'visitor' && conversation.status === 'active') {
          console.log('Triggering bot response for conversation:', conversationId);
          // Emit typing indicator immediately
          io.to(`conversation_${conversationId}`).emit('bot_typing', true);

          setTimeout(async () => {
             try {
               // 1. Perform RAG Search against PDFs
               const ragContext = await searchRelevantChunks(conversation.Bot.id, content, 3);
               console.log(`Found ${ragContext.length} relevant PDF chunks for the query.`);

               // 2. Generate response with context
               const responseContent = await generateBotResponse(conversation.Bot, content, conversation.Bot.faqs, ragContext);
               console.log('Generated bot response:', responseContent);

               const botMessage = await Message.create({
                 conversation_id: conversationId,
                 sender_type: 'bot',
                 content: responseContent
               });

               // Touch conversation to update updatedAt
               await Conversation.update({ updatedAt: new Date() }, { where: { id: conversationId } });

               io.to(`conversation_${conversationId}`).emit('bot_typing', false);
               io.to(`conversation_${conversationId}`).emit('new_message', botMessage);
             } catch (innerError) {
               console.error('Error in bot response timeout:', innerError);
               io.to(`conversation_${conversationId}`).emit('bot_typing', false);
             }
          }, 1000);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  });

  // Agent manually takes over
  socket.on('agent_join', async ({ conversationId, agentId }) => {
      try {
        const conversation = await Conversation.findByPk(conversationId);
        if (conversation) {
            await conversation.update({ status: 'human_handover' });
            socket.join(`conversation_${conversationId}`);
            io.to(`conversation_${conversationId}`).emit('agent_joined', { agentId });
        }
      } catch (error) {
          console.error(error);
      }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
};
