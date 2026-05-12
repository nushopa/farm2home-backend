module.exports.saveConsent = async (req, res) => {
    try {
        const body = req.body;

        if (!body || !body.userId || !body.preferences || !body.timestamp || !body.version) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const userId = req.user?.id || req.ip;

        const record = {
            userId,
            preferences: body.preferences,
            timestamp: body.timestamp,
            version: body.version,
            userAgent: req.get('User-Agent'),
        };

        await ConsentRecord.findOneAndUpdate(
            { userId },
            record,
            { upsert: true, new: true }
        );
        res.status(200).json({ message: 'Consent saved successfully' });    
    } catch (error) {
        res.status(500).json({ message: 'Error saving consent' });
    }
};