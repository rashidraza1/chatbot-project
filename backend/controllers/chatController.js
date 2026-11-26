const { Conversation, Message, Bot, Visitor } = require('../models');
const { generateBotResponse, generateChatTitle } = require('../services/openaiService');
const { searchRelevantChunks } = require('../services/pdfService');

exports.processChat = async (req, res) => {
  try {
    const { bot_id, conversation_id, user_id, visitor_id, content, visitor_name, visitor_email, visitor_phone, visitor_mobile, name, email, phone, mobile } = req.body;
    const vName = (visitor_name || name || '').trim();
    const vEmail = (visitor_email || email || '').trim();
    const vPhone = (visitor_phone || visitor_mobile || phone || mobile || '').trim();
    let conversation;

    if (conversation_id) {
      conversation = await Conversation.findByPk(conversation_id, { include: [Bot, Visitor] });
    }

    if (!conversation) {
      // Find existing visitor or create a new one to prevent duplicates
      let visitor = null;
      if (visitor_id) {
        visitor = await Visitor.findByPk(visitor_id);
      }
      if (!visitor && vEmail) {
        visitor = await Visitor.findOne({ where: { email: vEmail }, order: [['id', 'DESC']] });
      }
      if (!visitor && vPhone) {
        visitor = await Visitor.findOne({ where: { phone: vPhone }, order: [['id', 'DESC']] });
      }

      if (visitor) {
        await visitor.update({
          ...(vName ? { name: vName } : {}),
          ...(vEmail ? { email: vEmail } : {}),
          ...(vPhone ? { phone: vPhone } : {}),
          last_seen: new Date()
        });
      } else {
        visitor = await Visitor.create({
          name: vName || 'Guest',
          email: vEmail || null,
          phone: vPhone || null,
          last_page_url: req.headers.referer || null,
          last_seen: new Date()
        });
      }

      // Generate title
      const title = await generateChatTitle(bot_id, content);

      conversation = await Conversation.create({
        bot_id,
        visitor_id: visitor.id,
        user_id: user_id || null, // Optional user_id
        title,
        status: 'active'
      });
      // Need to re-fetch with Bot and Visitor
      conversation = await Conversation.findByPk(conversation.id, { include: [Bot, Visitor] });
    } else {
      // If conversation exists and visitor details are provided, update visitor
      if (conversation.visitor_id && (vName || vEmail || vPhone)) {
        await Visitor.update(
          {
            ...(vName ? { name: vName } : {}),
            ...(vEmail ? { email: vEmail } : {}),
            ...(vPhone ? { phone: vPhone } : {}),
            last_seen: new Date()
          },
          { where: { id: conversation.visitor_id } }
        );
      }
      // If conversation exists but user logs in midway
      if (user_id && !conversation.user_id) {
        await conversation.update({ user_id });
      }
    }

    // Save visitor message
    const userMessage = await Message.create({
      conversation_id: conversation.id,
      sender_type: 'visitor',
      sender_id: user_id || conversation.visitor_id,
      content
    });

    if (conversation.status === 'active') {
      // 1. Perform RAG Search against PDFs
      const ragContext = await searchRelevantChunks(conversation.Bot.id, content, 3);

      // 2. Fetch recent conversation history (last 10 messages)
      const previousMessages = await Message.findAll({
        where: { conversation_id: conversation.id },
        order: [['createdAt', 'DESC']],
        limit: 11 // Include current user message which was just saved
      });

      // Reverse to get chronological order and format for OpenAI
      // We skip the first one because it's the current message we just saved above
      const history = previousMessages
        .slice(1)
        .reverse()
        .map(msg => ({
          role: msg.sender_type === 'visitor' ? 'user' : 'assistant',
          content: msg.content
        }));

      // 3. Generate response with context, history, and optional visitor metadata
      const visitorMetadata = {
        name: vName || conversation.Visitor?.name,
        email: vEmail || conversation.Visitor?.email
      };

      const responseContent = await generateBotResponse(
        conversation.Bot,
        content,
        conversation.Bot.faqs || [],
        ragContext,
        history,
        visitorMetadata
      );

      const botMessage = await Message.create({
        conversation_id: conversation.id,
        sender_type: 'bot',
        content: responseContent
      });

      await Conversation.update(
        { status: conversation.status },
        { where: { id: conversation.id } }
      );

      return res.status(200).json({
        conversation_id: conversation.id,
        title: conversation.title,
        visitor_id: conversation.visitor_id,
        userMessage,
        botMessage
      });
    } else {
      return res.status(200).json({
        conversation_id: conversation.id,
        title: conversation.title,
        visitor_id: conversation.visitor_id,
        userMessage,
        info: 'Conversation requires agent handover or is closed'
      });
    }
  } catch (error) {
    console.error('Error processing chat:', error);
    res.status(500).json({ error: 'Failed to process chat', details: error.message });
  }
};

exports.updateVisitorSession = async (req, res) => {
  try {
    const { conversation_id, visitor_id, name, email, phone, mobile } = req.body;
    const vName = (name || '').trim();
    const vEmail = (email || '').trim();
    const vPhone = (phone || mobile || '').trim();

    // 1. If conversation_id is provided and has a visitor_id, update that visitor
    if (conversation_id) {
      const conv = await Conversation.findByPk(conversation_id);
      if (conv && conv.visitor_id) {
        await Visitor.update(
          {
            ...(vName ? { name: vName } : {}),
            ...(vEmail ? { email: vEmail } : {}),
            ...(vPhone ? { phone: vPhone } : {}),
            last_seen: new Date()
          },
          { where: { id: conv.visitor_id } }
        );
        const visitor = await Visitor.findByPk(conv.visitor_id);
        return res.json({ success: true, visitor });
      }
    }

    // 2. If visitor_id is provided directly, find and update that visitor
    if (visitor_id) {
      const existingById = await Visitor.findByPk(visitor_id);
      if (existingById) {
        await existingById.update({
          ...(vName ? { name: vName } : {}),
          ...(vEmail ? { email: vEmail } : {}),
          ...(vPhone ? { phone: vPhone } : {}),
          last_seen: new Date()
        });
        return res.json({ success: true, visitor: existingById });
      }
    }

    // 3. Prevent duplicate visitor creation: check if visitor with this email or phone already exists
    let existingVisitor = null;
    if (vEmail) {
      existingVisitor = await Visitor.findOne({
        where: { email: vEmail },
        order: [['id', 'DESC']]
      });
    }
    if (!existingVisitor && vPhone) {
      existingVisitor = await Visitor.findOne({
        where: { phone: vPhone },
        order: [['id', 'DESC']]
      });
    }

    if (existingVisitor) {
      await existingVisitor.update({
        ...(vName ? { name: vName } : {}),
        ...(vEmail ? { email: vEmail } : {}),
        ...(vPhone ? { phone: vPhone } : {}),
        last_seen: new Date()
      });
      return res.json({ success: true, visitor: existingVisitor });
    }

    // 4. Otherwise, create new visitor record
    const visitor = await Visitor.create({
      name: vName || 'Guest',
      email: vEmail || null,
      phone: vPhone || null,
      last_page_url: req.headers.referer || null,
      last_seen: new Date()
    });

    res.json({ success: true, visitor });
  } catch (error) {
    console.error('Error updating visitor session:', error);
    res.status(500).json({ error: 'Failed to update visitor session', details: error.message });
  }
};

exports.getConversations = async (req, res) => {
  try {
    const { user_id, bot_id } = req.query;
    if (!user_id || !bot_id) return res.status(400).json({ error: 'user_id and bot_id are required' });

    const conversations = await Conversation.findAll({
      where: { user_id, bot_id },
      include: [{ model: Visitor, attributes: ['id', 'name', 'email', 'last_seen'] }],
      order: [['updatedAt', 'DESC']]
    });
    res.json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

exports.getConversationMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const messages = await Message.findAll({
      where: { conversation_id: id },
      order: [['createdAt', 'ASC']]
    });

    const conversation = await Conversation.findByPk(id, {
      include: [{ model: Visitor, attributes: ['id', 'name', 'email', 'last_seen'] }]
    });

    res.json({ conversation, messages });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

exports.deleteConversation = async (req, res) => {
  try {
    const { id } = req.params;
    await Message.destroy({ where: { conversation_id: id } });
    await Conversation.destroy({ where: { id } });
    res.json({ message: 'Conversation deleted' });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

