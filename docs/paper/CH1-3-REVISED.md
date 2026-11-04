# MSUkaIP — Chapters 1, 2 and 3 (revised)

Reconstructed from `CAPTSONE1_Final_REVISED_PAPER01.06 (2).pdf` with every
revision applied in place. Changed and added passages are marked:

> **✅ CHANGED —** why it changed
> **➕ ADDED —** why it was added

**Read this to see the changes in context.** Do not paste it wholesale into your
document: it comes from the PDF's text layer, so tables have lost their column
formatting and page furniture has been stripped. Paste the marked passages into
your Word file, where your formatting is intact.

Sections 3.2.5, 3.3.1, 3.4 and 3.4.3 also change, but they are tables and
structured lists that survive extraction poorly — those are in
`CH1-3-BEFORE-AFTER.md`, which quotes them cleanly.

---

CHAPTER 1: INTRODUCTION

         Internet connectivity has become an essential component of the learning experience in
higher education, facilitating access to educational resources, participation in online discussions,
and remote collaboration (Jones, 2020). However, the continuous advancement of internet
connectivity leads people to be dependent on the internet, especially in the College of Information
and Computing Science, where the internet plays a vital role in enhancing the learning of the
students.

         Excessive reliance on internet connectivity in academic environments can lead to
significant disruptions in the event of network failures, affecting productivity and communication.
(Smith & Brown, 2018). This excessive dependence on the internet, if some instances suddenly
happen, such as a poor connection on the internet due to many people that are connected, then
individuals who have an ongoing activity through online will have catastrophic consequences, such
as undelivered messages or failure to make a voice call during this period and for them to ensure
continuity, they frequently resort to buying mobile data load for texting or calling.This imposes a
significant financial burden, and for those who cannot afford it, it leads to delayed notifications and
further communication failures.

         This is particularly critical in the College of Information and Computing Sciences, where
most activities are internet-based. This issue underscores the weakness of the available
communication platforms that prioritize online functionality. This causes delays,
miscommunication, and loss of productivity when the internet is disrupted. This is further
aggravated because students and faculty must constantly buy costly mobile data loads for essential
text and voice communication. The need for alternative communication systems that can operate
on local networks without relying on the internet is becoming increasingly evident in educational
institutions seeking to ensure the continuity of academic activities.

         While there are many communication platforms available today, most of them rely heavily
on internet access to function. Very few systems are capable of operating offline or through local
networks, this creates a clear research gap. That's what led the researchers to MSUkaIP as a solution
for this problem. MSUkaIP is a local Wi-Fi-based communication system that enables users to send
messages and make calls without relying on internet connectivity
1.1 Project Context
         The capstone project entitled "MSUkaIP: An Alternative web-app communication

system in CICS using Local Area Network" is a web-app based designed to provide a dedicated
communication platform that operates entirely within the College of Information and Computing
Sciences' local network environment. The project aims to deliver reliable messaging and voice
communication through the existing LAN infrastructure, independent of any internet connection.
The project is scheduled to begin in September 2025 and conclude by the end of May.

         The problem addressed by this project is the college's heavy reliance on internet-dependent
communication platforms. When internet access becomes unstable or unavailable, students and
faculty face dropped calls, undelivered messages, interrupted communication, and reduced
productivity during transaction activities. These disruptions contribute to confusion, delays, and
academic stress.

         MSUkaIP is developed to offer a user-friendly web-application messenger tailored to the
needs of CICS students and faculty. The system will support text messaging, image transfer, and
audio communication through the local Wi-Fi network, without relying on the internet. Server
administrators will assist with monitoring system security and maintaining stable local network
performance. The system will be implemented across existing Wi-Fi access points surrounding the
college.

         The researchers will study relevant technologies such as Voice over IP (VoIP), TCP, and
UDP for packet transmission, as well as the current network structure of CICS. Because the college
already maintains multiple Wi-Fi access points, the necessary infrastructure is largely available,
and users will be able to access the system anywhere within the CICS building.

1.2 Purpose and Description
         This capstone project aims to develop MSUkaIP, a local Wi-Fi-based communication

system designed to allow students and faculty to send messages and make voice calls through the
CICS local area network, even in the absence of internet connectivity.
         The primary purpose of the project is to support uninterrupted communication within the
college, reduce internet traffic during peak periods such as enrollment, and provide a dependable
alternative when internet connectivity fails. The project also seeks to address challenges caused by
unreliable internet access, which commonly disrupts essential tasks.

         Students will contribute by providing firsthand insights into their communication needs,
difficulties related to internet dependence, and the specific features they expect from a college
communication tool. Faculty members will assist in identifying communication requirements
essential for instructional activities, ensuring that the system supports communication continuity

1.3 Objectives

General Objectives:
To design and implement an alternative communication system that operates within the CICS local
area network without the need for internet connectivity.
To design, develop, and implement a LAN-based VoIP and Messaging System for the CICS that is
capable of supporting 50–100 concurrent users without external internet dependency.

> **✅ CHANGED —** was "at least 100". The paper used three different figures for this; all now read 50–100.

Specific objectives
This study intends the following:

    1. To analyze the technical requirements of VoIP, TCP/IP, and UDP protocols and the CICS
         network infrastructure to ensure system compatibility.

    2. To develop a secure web application for real-time messaging and voice calls that operates
         exclusively over the LAN using WebRTC.

        3. To integrate the system into the CICS network with institutional email authentication, an
         administrator account-approval workflow, and AES-256-GCM encryption of stored messages
         and files, for secure access by 50–100 concurrent users.

> **✅ CHANGED —** adds the approval workflow (a built feature the objective did not claim) and names the cipher mode. "AES-256" alone does not say GCM, which is what provides tamper detection.


    4. To evaluate system performance and usability through a 5-point Likert Scale survey with
         30 respondents to measure functionality and reliability.
1.4 Scope and Limitations
Scope

                  This project focuses on the design, development, and implementation of MSUkaIP, an
offline communication system accessible to all students, faculty, and administrators within the
College of Information and Computing Sciences. The system supports real-time text messaging in
private and group conversations, lightweight image sharing, file sharing for academic documents
(PDF and DOCX), push-to-talk voice messages, and localized voice calls over Wi-Fi networks
without internet connectivity. Administrators can additionally send broadcast messages to all
active users, review a security audit log, and monitor system usage through a dashboard. The
system also includes a built-in anonymous evaluation survey used to gather respondent feedback
for the study.

> **✅ CHANGED —** the old paragraph omitted group conversations, voice messages, broadcast, the audit log and the survey — all built and demonstrable. Also fixes the comma splice in "lightweight image, sharing".


Limitation

         This project is limited to the physical coverage area of the CICS building. Users must
connect to the college's Wi-Fi network to access the system. All features, including text messaging,
lightweight image sharing, file sharing with Docs and PDFs and audio communication, are
restricted to this local network environment. User authentication requires valid institutional email
credentials. Furthermore, file sharing and image sharing is strictly limited to a maximum size of
5MB per transmission to ensure optimal network performance and prevent congestion within the
local server. Consequently, the system will not operate outside the CICS Wi-Fi coverage range.

         Voice calls are limited to one-to-one conversations and to group chats with a defined
membership. Group calls are not available in the Global Chat channel: WebRTC group calls use a
full mesh topology in which every participant holds a direct connection to every other, so a call
among n users requires n(n−1)/2 connections. Because Global Chat contains every approved
account in the college, a mesh call there would exceed the capacity of the CICS local network.
Furthermore, the encryption of messages and files at rest protects stored data against unauthorized
access to the database file or its backups; it is not end-to-end encryption, as the server holds the
encryption key in order to support the administrative and audit functions the institution requires.

> **➕ ADDED —** both are boundaries a panel will find on its own. Declared, they read as engineering judgement rather than oversights.


1.5 Significance of the Project

         The MSUkaIP is significant because it provides a reliable and secure web-application
communication platform that does not require internet connectivity. By reducing dependence on
external networks, the system enhances productivity, lowers communication costs, and ensures
continuity during internet outages. The primary beneficiaries are

         The Client. The MSUkaIP gives them the immediate ability to communicate without being
restricted by poor internet or high personal costs. Since MSUkaIP runs on the college's local
network (LAN), every student and faculty member can send urgent messages and start voice calls
for their academic tasks and meetings, even when the external internet is completely down. This
single feature ensures that all classes and collaborative work remain uninterrupted and everyone is
financially unburdened by the need to purchase mobile data.

         Administrators. They gain a managed and centralized communication system that operates
entirely within the college's control. They can monitor the system's security and performance, using
access logs and session data to ensure consistent and secure communication within the college.
This dedicated LAN-based tool allows for immediate internal crisis communication and helps them
minimize disruptions caused by external network outages.
CHAPTER 2: REVIEW OF RELATED LITERATURE AND SYSTEMS

         This chapter presents the relevant theories and systems that support the attainment of the
goals and objectives of the study
2.1 Review of Related Theories

2.1.1 Client-Server Architecture Model

         The Client-Server Architecture Model describes a network structure where multiple client
devices request services or resources from a centralized server. Tanenbaum and Van Steen (2017)
explain that this model allows efficient resource management, centralized control, and reliable
communication within local networks. MSUkaIP follows this architecture by hosting
communication services on a local server within the CICS LAN, while users access the system
through client devices connected via Wi-Fi. This model justifies the system's ability to function
independently of the campus WAN or internet gateway, ensuring reliable message delivery and
VoIP signaling within the local infrastructure

2.1.2 Distributed System Theory

         Distributed Systems Theory explains how multiple interconnected computers work
together to provide a unified service while sharing resources across a network. According to
Coulouris et al. (2012), distributed systems improve fault tolerance, scalability, and performance
by distributing processes across nodes. MSUkaIP reflects this theory by operating across multiple
devices connected to the CICS LAN, where communication services such as messaging and VoIP
are distributed among users without relying on a single external network. This supports the project's
goal of maintaining communication continuity even during internet failures

2.1.3 National ICT Standards and Framework
         The development and implementation of MSUkaIP are aligned with the following national

frameworks established by the Department of Information and Communications Technology
(DICT). These standards provide the legal and technical basis for establishing internal
communication systems within a government-funded educational institution

          2.1.3.1 Philippine e-Government Interoperability Framework (PeGIF)

         The Philippine e-Government Interoperability Framework (PeGIF) provides the technical
standards and policies for seamless data exchange and system integration within government-
funded institutions. According to the Department of Information and Communications Technology
(DICT, 2017), technical interoperability ensures that systems use open and standardized protocols
to remain flexible and scalable. MSUkaIP aligns with this framework by utilizing standardized
communication protocols such as TCP/IP for messaging and UDP for VoIP services. By adhering
to these national standards, the project ensures that the messenger can integrate with existing CICS
network hardware and maintain compatibility with future university-wide ICT infrastructure
without the need for proprietary modifications.

         2.1.3.2 National ICT Ecosystem Framework (NICTEF): Infrastructure Resilience

         The National ICT Ecosystem Framework (NICTEF) serves as the strategic roadmap for
the country's digital environment, with a primary pillar focused on "Responsive and Resilient
Infrastructure." The DICT (2019) emphasizes that critical communication systems must be built
with redundancy to ensure business continuity during external service disruptions. MSUkaIP
reflects the core objectives of NICTEF by providing a Local Area Network (LAN)-based failover
mechanism. By enabling internal academic communication to function independently of an
external Internet Service Provider (ISP), the system implements the national standard for
infrastructure resilience, ensuring that essential coordination within the college remains
uninterrupted during regional internet outages.

         2.1.3.3 National Government Identity and Security Standards

         The National Cybersecurity Plan and the GovMail Service Guidelines (Memorandum
Circular 2015-002) mandate that internal government and academic communications must use
trusted identities to ensure accountability and data integrity. These standards require the use of
official institutional accounts to prevent unauthorized access and data breaches. MSUkaIP
incorporates these security standards by utilizing Institutional Email Authentication as the primary
gatekeeper for user access. This ensures that the system operates within a "trusted environment"
where only verified members of the MSU-CICS community can communicate, thereby fulfilling
the national requirement for secure identity management and protecting sensitive academic
information from external threats.

2.1.4 Quality of Servicee (QoT) Theory
         The Quality of Service Theory refers to a set of technologies and techniques used to

manage network resources by prioritizing specific types of data traffic to ensure reliable
performance. According to Wang (2001), QoS is essential for networks that handle diverse traffic
types, as it provides the mechanisms necessary to minimize "jitter," packet loss, and latency for
time-sensitive applications. This theory is fundamentally critical to the MSUkaIP system,
particularly for its Voice over IP (VoIP) module. Because voice data is transmitted via User
Datagram Protocol (UDP), it is highly sensitive to network congestion. By applying QoS principles,
the system can prioritize voice packets over standard text or file transfers within the CICS Local
Area Network. This ensures that even during periods of high local network activity within the
department, audio communication remains clear and uninterrupted independently of external
internet conditions, directly supporting the project's objective of providing a high-quality, real-time
institutional communication tool.

2.1.5 Real-Time Communication (RTC) Theory
         The Real-Time Communication theory refers to the framework of protocols and

architectural standards designed to facilitate the near-instantaneous exchange of information across
a network without perceptible latency. According to Johnston (2014), RTC is characterized by the
elimination of transmission delays to ensure that digital interaction whether through text, or
voicemimics the flow of live, face-to-face communication. This theory is highly applicable to the
development of MSUkaIP, as it provides the technical justification for the integration of
WebSockets and Socket.IO to manage persistent, two-way messaging, as well as the use of
WebRTC for the system's VoIP module. By applying RTC principles, the study ensures that the
localized communication system achieves its objective of maintaining a message latency of less
than one second, providing students and faculty with a high-performance alternative to internet-
dependent platforms.
2.1.6 Shanon-Waver Communication Method
         Shannon-Weaver Model of Communication describes communication as a process

involving a sender, transmitter, channel, receiver, and destination, while accounting for noise that
may distort the message (Shannon & Weaver, 1949). In digital network environments, noise can be
interpreted as latency, jitter, packet loss, and bandwidth congestion that affect data transmission
quality. MSUkaIP applies this model by reducing communication noise through LAN-based
transmission, which minimizes latency and packet loss compared to congested Wide Area Network
(WAN) connections. This theory supports the system's design goal of improving the reliability and
quality of message and voice communication within the CICS local network.

2.1.7 Technology Acceptance Model (TAM)
         Technology Acceptance Model (TAM) proposes that users' acceptance of a system is

primarily influenced by perceived usefulness and perceived ease of use (Davis, 1989). In an
academic environment, students and faculty are more likely to adopt a communication system if it
improves productivity and is simple to operate. MSUkaIP applies TAM by focusing on a user-
friendly interface and practical features such as local messaging and voice calls, which directly
address communication disruptions caused by unreliable internet access. This theory supports the
expectation that MSUkaIP will be accepted and adopted within CICS.

         2.1.3.4 Republic Act No. 10173 (Data Privacy Act of 2012)

         Republic Act No. 10173, the Data Privacy Act of 2012, mandates that entities processing
personal information implement reasonable organizational, physical, and technical security
measures to protect personal data against unauthorized access, disclosure, and destruction
(National Privacy Commission, 2012). Section 20 of the Act specifically requires safeguards such
as access control, encryption, and the ability to identify and monitor security incidents. MSUkaIP
operationalizes these requirements through several technical measures: user passwords are hashed
with the bcrypt algorithm; chat messages and uploaded files are encrypted at rest using
AES-256-GCM; uploaded files are stored outside the public web directory and served only to
authenticated users; repeated failed logins are rate-limited; user sessions can be revoked
immediately through token versioning; and an audit log records the actor, IP address, and device of
every security-relevant action. The audit log can be filtered by action type, user, and date range, so
that a specific class of event — for example, all failed login attempts against one account in a given
week — can be isolated from routine activity, satisfying the Act's monitoring requirement. These
measures ensure that a communication system operated by a government-funded academic
institution meets its statutory obligation to protect the personal data of its students and faculty.

> **➕ ADDED —** new subsection after 2.1.3.3. Also add to REFERENCES: National Privacy Commission. (2012). *Republic Act No. 10173: Data Privacy Act of 2012*. Republic of the Philippines. https://www.privacy.gov.ph/data-privacy-act/


2.2 Review of Related Systems

         This section reviews existing communication systems related to the proposed study and
examines their limitations in addressing the communication needs of the College of Information
and Computing Sciences (CICS), particularly during internet disruptions.

2.2.1 BitChat (University of the Philippines)

         BiTChat, developed by the University of the Philippines, is a campus-based messaging
system designed to support communication through ad-hoc device-to-device networking. Devices
within approximately a 300-meter range can form temporary networks, allowing messages to hop
across multiple nodes and reach recipients beyond the sender's immediate vicinity. This approach
enables communication without reliance on external internet connectivity and is effective for
campus-level coordination.

         However, BiTChat is primarily optimized for messaging functions, with limited support
for voice communication and centralized management. Its implementation is also tailored to UP's
specific infrastructure and mobility-oriented use cases. Consequently, while BiTChat demonstrates
the feasibility of decentralized campus communication, it is less directly applicable to CICS, which
requires a structured LAN-based system with centralized control and integration into departmental
workflows.
2.2.2 Briar Messenger
         Briar is an open-source, decentralized messaging application designed for high-security

environments where internet connectivity is frequently blocked, monitored, or unavailable. Unlike
traditional messaging platforms that rely on central cloud servers, Briar utilizes a peer-to-peer (P2P)
architecture that synchronizes data via Bluetooth and Wi-Fi Direct to ensure continuous
information flow during internet blackouts or in remote locations. This system serves as a primary
technical reference for MSUkaIP due to its robust offline functionality and its implementation of
real-time protocols over a local mesh network. While Briar focuses on decentralized
synchronization, MSUkaIP adopts a similar goal of "Internet Independence" but optimizes it for a
campus environment using a LAN-based Client-Server model. Furthermore, Briar's development
of secure, low-latency VoIP features that operate without a central authority provides a critical
feasibility benchmark for the MSUkaIP VoIP module demonstrating that high-quality voice
communication is achievable over localized, non-internet infrastructures.
2.2.2 Cisco Jabber
         Cisco Jabber is an enterprise-grade unified communications client that supports instant

messaging, voice over IP (VoIP), video calls, and file sharing. It utilizes a hybrid communication
model, employing TCP for signaling and data transfer and UDP for real-time voice and video
transmission. Jabber operates efficiently within enterprise LAN environments when connected to
Cisco's unified communications servers.

         Despite its reliability and feature completeness, Cisco Jabber requires licensed Cisco
infrastructure and is primarily designed for corporate environments. The cost and complexity of
deployment make it impractical for localized academic use within CICS. MSUkaIP follows a
similar hybrid protocol concept for real-time communication but is designed as a lightweight, web-
based system hosted on a local server, providing a cost-effective and institution-specific alternative
without licensing dependencies.

2.2.3 LAN Chat Messegner (LCM) Using Java Programming with VoIP
         This study introduces a LAN-based messaging application designed to enable cost-free

internal communication for organizations. The system integrates text messaging, and Voice over
IP (VoIP) calls within a local network, eliminating the need for internet-based services.
Built on Java with TCP/IP client-server architecture, the system allows multiple users to
communicate simultaneously over the LAN. Messages and files are transmitted in real-time, while
VoIP calls provide audio communication without external connectivity.
The findings validate that multiple communication features can be successfully merged into a
standalone LAN application. The system is highly effective within the networked environment but
cannot extend its services beyond the local network.

2.2.4 Zello (Local Area Network Mode)
Zello is a globally recognized "Push-to-Talk" (PTT) application that provides instantaneous,
walkie-talkie-style voice communication. While typically cloud-based, Zello offers a specific
enterprise version that can be configured to operate on a private local server, allowing devices on
the same Wi-Fi network to communicate without an external internet connection. According to
Zello Inc. (2023), the platform is engineered for high-quality, low-latency audio using specialized
Voice over IP (VoIP) protocols optimized for real-time institutional coordination. This system
serves as a professional-grade benchmark for MSUkaIP, justifying the inclusion of a dedicated VoIP
module to ensure clear and immediate voice interaction within the CICS building. While Zello is
primarily voice-focused, MSUkaIP improves upon this model by integrating institutional email
authentication and multi-modal features--such as text messaging and file sharing--into a single,
unified web application tailored for academic workflows.
14
          2.3 Table Matrix of Related Systems

Features                    Proposed           Zello         LAN Chat    Briar      BitChat           Cisco
                            System             (Private      Messenger   Messenger  (UP)              Jabber
                            (MSUkaIP)          Server)       (LCM)

Functions Without Internet                                                                            

LAN / Wi-Fi Based                                                                                     

Two-Way Comm.                                                            (P2P/Mesh)
(Chat/Voice)                                                                                (Ad-hoc)
Multimedia (Files/Images)
Web-Based Interface                                                                                   

Institutional Email Auth                       (Primary                  (Primary (Primary

                                               Voice)                    Chat)      Chat)

                                                                                                      

                                                                                                      

                                               (App-         (Java App)  (App-      (App-             (Software)
                                               based)                    based)     based)
2.4 Technical Background
         The proposed study will be conducted at the College of Information and Computing

Sciences (CICS) of Mindanao State University - Main Campus. As a leading institution for
technology education, the college is equipped with a Local Area Network (LAN) and various Wi-
Fi access points distributed across its buildings. Despite this infrastructure, the current mode of
communication for academic materials relies heavily on internet-dependent platforms such as
Facebook Messenger, Google Classroom and Telegram.

         This chapter presents the organizational structure of the CICS to identify the key
stakeholders of the system. Furthermore, it illustrates the existing workflow of information
dissemination to highlight the communication gaps caused by internet fluctuations, which the
proposed MSUkaIP system aims to address.
2.4.1 Organizational Chart
         The figure above illustrates the hierarchical structure of the College of Information and
Computing Sciences (CICS) at Mindanao State University - Main Campus. This structure serves
as the foundation for the User Access Levels within the proposed MSUkaIP system.
2.4.2 Workflow
2.4.2 Existing Workflow
         The diagram depicts the existing manual workflow utilized by the faculty and students of
CICS for communication. Currently, the process is heavily reliant on external, internet-based
platforms such as Facebook Messenger, Google Classroom, and Telegram.

         As shown in the flowchart, the dissemination process begins when a sender (Dean or
Faculty) initiates a message or lightweight photo sharing. The workflow encounters a critical
decision point: "Is Internet Connectivity Available?" If the signal is stable and the user has
mobile data, the message is transmitted successfully. However, if the internet connection is unstable
or the student lacks data credits, a common scenario on campus, the process terminates or
experiences significant latency. This dependency creates a "single point of failure," resulting in
delayed announcements and disrupted academic coordination.
2.4.3 Proposed Workflow
         The figure above illustrates the streamlined workflow of the proposed MSUkaIP system.
Unlike the existing method, this workflow eliminates the dependency on external Internet Service
Providers (ISPs) by utilizing the college's existing Local Area Network (LAN) infrastructure.

         In this process, the user (Faculty or Student) simply connects to the campus Wi-Fi access
point. Instead of routing data through the internet, the system directs the user to the local MSUkaIP
server via a web application. Once authenticated using their institutional credentials, users can send
messages and lightweight images that are routed directly through the local server. This ensures that
communication remains real-time and cost-free, guaranteeing the delivery of academic materials
even during internet outages or network congestion.
CHAPTER 3: METHODOLOGY
        Figure 3.1 illustrates the Agile Method that will be used in the development of the project

                  Figure 3.1 illustrates the Agile Method that will be used in the development of the project

         This capstone project utilizes the Scrum Agile Methodology because its iterative approach
is best suited for developing a complex, real-time system like MSUkaIP. Firstly, Scrum's fixed-
length Sprints allow for Incremental Delivery and Risk Mitigation, enabling the team to develop
and test core features like Text Messaging and the complex VoIP Module in isolation, ensuring
stability before final integration. Secondly, Scrum mandates Continuous User Feedback through
frequent Sprint Reviews with respondents, which guarantees the final product meets the required
Usability and directly addresses the communication issues identified in the Empathy Map. Finally,
by managing the Product Backlog, Scrum facilitates Flexible Scope Control, allowing the team to
prioritize Mandatory functions and adapt quickly to any technical challenges or changes in
requirements, thereby providing comprehensive Risk Management throughout the project timeline.
3.1 Requirements Gathering
   3.1.1 Empathy Map

                                                               Figure 3.2 Empathy Map

         The empathy map for CICS students and faculty describes how they struggle with the
unreliability of internet-dependent platforms for daily academic communication. They frequently
encounter dropped calls, failed file transfers, and delayed announcements when the network is
unstable, which makes their workflow inefficient and causes significant academic stress and
confusion. They want a dependable, localized communication system that operates entirely on the
campus Wi-Fi to ensure real-time messaging and lightweight image sharing without relying on an
internet connection.
3.1.2 Functional Requirements and Non-functional Requirement

Requirement  Table 3.1 Functional and Non-functional Requirements  Priority
                                             Type                  Mandatory

User Authentication: The system shall          Functional
allow students and faculty to log in using
their verified institutional Email and
password.

Users shall be able to send and receive text   Functional          Mandatory
messages in real-time to other connected
users without internet access.

The Admin shall be able to send a              Functional          Mandatory
"Broadcast Message" that notification to all
active users.

The Admin shall be able to approve pending     Functional          Mandatory
registrations, and add, edit, deactivate, or
remove user accounts.

> **✅ CHANGED —** accounts are managed by identity, not IP address. The approval step is the first thing demonstrated in the admin dashboard.


The system shall store chat logs locally so    Functional          Mandatory
users can view past conversations upon
relogging.

Users shall be able to send lightweight files  Functional          Mandatory
(Docs and PDFs) and images within the
local network.
Users shall be able to initiate peer-to-peer     Functional                 Mandatory
voice calls within the local network
(WebRTC).

Requirement                                                  Type           Priority
                                                                               Mandatory
Text messages should be delivered with a         Performance
latency of less than 1 second or more                                       Mandatory
within the CICS LAN environment.

The system must remain fully functional for      Availability
local communication even when the external
ISP (Internet) connection is down.

The local server should support at least 50-     Reliability / Scalability  Mandatory
100 concurrent user connections without
crashing.

User passwords must be hashed using bcrypt       Security                   Mandatory
(cost factor 12); chat messages and uploaded
files must be encrypted at rest using
AES-256-GCM; uploads must be stored in a
restricted directory served only to
authenticated users; repeated failed logins
must be rate-limited to five attempts per
fifteen minutes per account and address; the
administrative and student portals must be
separated so that neither role can
authenticate on the other's page; and a
secure HTTPS origin must be available on the
local network.

> **✅ CHANGED —** "encrypted (e.g., hashed)" conflates encryption with hashing — they are different operations, and passwords need hashing precisely because it is one-way. An IT panel will pick this up.


The user interface (UI) must be responsive       Usability                  Mandatory
and accessible on both mobile browsers
(Android) and desktop browsers.
The web application should run on any        Compatibility / Portability  Mandatory
standard browser (Chrome, Edge, Firefox)
without requiring client-side installation.
3.1.3 Gantt Chart (based on 3.1.2)
3.2 Design
         3.2.1 Hierarchical Input-Process-Output

 Figure 3.2 illustrates the Hierarchical Input-Process-Output that graphically represents the proposed system's control
                                                          structure and hierarchy.
         The Hierarchical Input-Process-Output (HIPO) diagram provides a top-down overview of
the MSUkaIP system structure. It decomposes the main application into its core functional
Messaging, VoIP, User, and Admin . Each Function is broken down into its respective sub-
processes, showing how the system handles data from initial user input, through internal
processing, and finally to system output.

         The primary communication functions. Messaging covers text communication, message
handling, and real-time delivery, while VoIP manages voice session setup, signaling, and audio data
transmission. This streamlined view ensures that the essential communication features are clearly
organized and aligned with the system's architectural goals.

   3.2.2 Input-Process-Output

                              Figure 3.3 IPO Diagram for Data Transformation
1. User & Authentication Module

         The User and Authentication Module is the system's entry point, ensuring only authorized
users can access the platform. It begins when the user enters their institutional email and password.
These credentials are checked against the database to confirm their validity. If the information
matches, the system generates a session token (JWT) that identifies the user and grants access to
the system. If not, an error message is returned. This module ensures secure login and provides the
token needed to access all other system features.

2. Messaging Module

         The Messaging Module handles real-time chat communication within the system. It begins
with the user's input, which includes the message content and the intended recipient. The system
processes this by validating the message, saving copy to the database for record-keeping, and
routing it to the target user through WebSocket for fast, real-time delivery. The output is a
successfully delivered message along with a notification sent to the recipient, ensuring reliable and
instant communication between users.

3. VoIP (Voice over IP) Module

         The VoIP Module manages real-time voice calls within the system. It begins with the user's
call request and the audio packets captured by the microphone. The system processes this through
signaling, which establishes and negotiates the call connection. Once the session is set up, audio is
streamed over RTP on UDP to ensure fast, uninterrupted communication. The output is an active
voice call between users along with recorded call details, such as the start time, end time, and
participants.

4. Administration Module

         The Administration Module oversees user management and system-wide operations. It
begins with inputs from administrators, such as adding or removing users, creating groups, sending
broadcasts, or managing sessions. The system processes these actions by verifying admin
permissions and executing the appropriate commands. The output includes updated user records,
newly created groups, broadcast messages delivered, and real-time monitoring of user activity,
ensuring smooth and controlled system management.
   3.2.3 Use Case Diagram

                   Figure 3.4 Use Case Diagram for Interaction Between the System
         The Use Case Diagram visualizes the functional interactions between the system and its
primary actors: Students, Faculty, and the Admin/Dean. It defines the scope of the system by
illustrating the specific actions each user role is permitted to perform, such as sending messages,
initiating voice calls, creating channels, or managing user accounts. This diagram establishes the
system's boundaries and ensures that the developed features align with the distinct privileges and
responsibilities of each stakeholder within the CICS.
   3.2.4 Entity-Relationship Diagram

                                    Figure 3.5 Entity-Relationship Diagram
                  The Entity-Relationship Diagram defines the logical database structure of MSUkaIP. The
schema comprises seven entities. Users stores account identity, the bcrypt password hash, role,
account status, and a token version used for session revocation. Messages stores every message
with its conversation key, type, encrypted body, and file metadata, and is linked to its sender.
Groups stores group chats and their creator, while Group Members resolves the many-to-many
relationship between users and groups and enforces uniqueness so that a user appears in a group
exactly once. Calls records voice call attempts with caller, receiver, status, and duration. Audit
Logs records security-relevant actions with the acting user, IP address, and device.

         Survey Responses stores evaluation results and is deliberately not linked to the users table:
the absence of that relationship is what makes the evaluation anonymous, since a stored response
cannot be traced back to an account.

         All relationships are enforced with foreign keys, and the database runs with foreign-key
constraints enabled, so referential integrity is maintained by the database engine rather than by
application code alone.

> **✅ CHANGED —** the old paragraph never said what the entities are. **Figure 3.5 must also be replaced** with docs/erd.png — the current diagram predates audit_logs and survey_responses, both central to the RA 10173 section and Chapter 4.

   3.2.5 Architectural Design

                                            Figure 3.6 Architecture Diagram
         A. WebSocket
         The web version of Messenger communicates via standard HTTPS and uses WebSockets
for instant notifications and constant communication between the server and the web client.
         B. Socket.IO
         Socket.IO is a JavaScript-based real-time communication library that enables instant, bi-
directional, event-driven data exchange between clients and a server. Unlike traditional HTTP
requests that follow a request-response pattern, Socket.IO keeps a persistent connection open,
allowing both the client and server to send data at any moment without waiting for each other.
         This is essential for systems that require low-latency communication, such as messaging
platforms, collaborative applications, and VoIP signaling.

         C. VoIP Signaling (WebRTC)
         This component sets up and manages voice calls. It helps two devices connect directly for
voice communication by handling call setup and connection details. Once connected, WebRTC
sends voice data smoothly using UDP, making calls low-latency and suitable for the campus
network.
         WebRTC is a technology, which involves STUN and TURN servers (Session Traversal
Utilities for NAT and Traversal Using Relays around NAT) to establish peer-to-peer connections.
         D. PostgreSQL / MySQL Database
         This database stores all important system information such as user accounts, group chat,
chat messages, and system logs. It keeps data organized and ensures that everything is saved
securely and can be retrieved anytime.
         E. Redis Cache
         Redis temporarily stores fast-changing data such as who is online, active sessions, and
quick lookups. This helps the system respond instantly and reduces delay, especially during
messaging and presence updates.
         F. Transport Layer
         TCP ensures reliable, ordered, and secure delivery of data like messages and file transfers.
UDP is used for real-time services like voice calls, where speed is more important than perfect
reliability.
    � UDP: Provides fast, low-latency delivery for real-time communication like voice calls.
    � TCP: Ensures reliable and ordered delivery of messages and other critical data.
         TCP 3-Way Handshake
         The TCP 3-way handshake is the process used to establish a reliable connection between a
client and the server before exchanging data. It ensures that both sides are ready, synchronized, and
able to communicate without errors.
Steps of the 3-Way Handshake

1. SYN (Synchronize) - The client sends a SYN packet to the server to request a connection.

2. SYN-ACK (Synchronize-Acknowledge) - The server responds with a SYN-ACK packet,
    confirming the request and showing it is ready.

3. ACK                        (Acknowledge)  -

The client sends back an ACK packet, completing the handshake and establishing a stable

TCP session.
3.2.6 Network Architecture Design

                                            Figure 3.7 Architecture Diagram
         Network Architecture Design shows how the MSUkaIP system is deployed inside the
college using the existing LinkCode network topology of the college. It illustrates how the local
server is connected to the college switches, access points, and wired backbone, and how data flows
through these paths to deliver messaging, VoIP.

         The local MSUkaIP server is placed inside the college network and connected to the
LinkCode-managed switches and Wi-Fi access points. From there, data is delivered directly to
students, faculty, and admins through college Wi-Fi. This ensures fast, secure, low-latency
communication since all traffic stays within the local LinkCode infrastructure without using the
external internet.

3.3 Development

         The development of the MSUkaIP messaging system involves designing the appropriate
software architecture, selecting suitable development tools, and identifying the required hardware
resources to ensure smooth implementation within the College of Information and Computing
Sciences (CICS) Local Area Network (LAN). This section outlines both the software and hardware
specifications needed to support the system's core functions, including messaging, file sharing,
channel management, session tracking, and administrative monitoring.

   3.3.1. Software Specification

         This section outlines all software tools, technologies, and platforms required to develop
and deploy the MSUkaIP LAN-Based Messenger System.

   A. Programming Language  Purpose
Language
Python                      Backend logic for authentication, message
                            handling, file transfer, and channel
                            management.
HTML,CSS, and JavaScript              Front-end interface for real-time user
Node.js, Python (FastAPI)             interaction

                                      Manages API requests and server-side
                                      operations.

B. Development Framework

Framework / Library                   Function

Node.js (Express.js) / Python (FastAPI, Manages API requests and server-side

Django)                               operations.

Socket.IO / WebSocket                 Provides real-time communication between
                                      clients over LAN.

Vue.js / React                        Enables a responsive, user-friendly interface.

C. Database Management System

DBMS                                  Purpose

MySQL / MariaDB                       Stores persistent system data aligned with the
                                      ERD (users, messages, channels, logs).

D. Server and Communication Protocol

Protocol                              Purpose

TCP                                   Reliable message delivery,       login
                                      authentication, file transfers.

UDP                                   Optional for VoIP or fast lightweight
                                      broadcasting.

HTTP/HTTPS                            API communication between server and client.
WebRTC                               To establish and manage real-time voice calls
                                     by connecting two devices directly and
WebSocket                            transmitting audio through UDP, ensuring fast,
   E. Operating System               low-latency communication within the campus
                                     network.
OS                                   Real-time messaging and presence updates.
Windows
                                     Purpose
                                     Deployment environment for backend server,
                                     DB, and services.

F. Other Tools

Tool Category   Tools                    Purpose
                                         Code tracking and collaboration.
Version Control GitHub / GitLab          API testing, performance testing.
                                         Network protection and monitoring.
Testing Tools   Postman, JMeter          Measuring and tracking the variation in
                                         delay (latency) between data packets.
Security Tools Firewall rules, IDS       Diagram creation.
                                         Designing the network architecture
Packets         Jitter Monitoring
Monitoring

UML Tools       Lucidchart, Draw.io

Network Design Cisco Packet Tracer
3.3.2. Hardware Specification
         This section lists the hardware components required to run, test, and deploy the MSUkaIP

system.
   A. Server Hardware

Component  Minimum           Purpose
Processor  Specification
RAM
Storage    Intel Core i5 / Ryzen 5 Handles backend processes and real-time
                                         communication.

           8 GB              Ensures smooth server operations and multiple
                             connections.

           256 GB SSD        Database storage, message logs, and file transfers.

Network    Gigabit Ethernet  Supports LAN-wide real-time communication.
Interface

B. Client Workstations

Component  Minimum Specification        Purpose
Processor  Intel Core i3 / Ryzen 3
RAM        4 GB                         Running the messaging client smoothly.

Storage    120 GB                       Handles UI rendering and messaging
                                        functions.

                                        Installation of client app and temporary
                                        files.
Network    100 Mbps or Gigabit  Stable LAN connectivity.
Interface  Ethernet

  C. Mobile Devices (Android Smartphones)
Component Minimum Specification Purpose

CPU        64-bit architecture  Handles app performance and real-time
                                messaging.

RAM        4 GB or higher       Smooth app usage and background processes.

Storage    32 GB Internal       Stores app data and cached files.

Connectivity Wi-Fi (2.4/5 GHz)  Connects to LAN via Access Points.

     D. iOS (Phone)
Component Minimum Specification Purpose
Processor  Apple A12 Bionic or  Ensures smooth performance for the iOS client
RAM        higher               app.

           4GB or higher        Handles messaging features and real-time
                                communication.
Storage    32 GB
                                Stores app data and cached files.
Connectivity Wi-Fi (2.4/5 GHz)
                                Provides stable LAN connectivity through access
                                points.

E. Networking Hardware          Specification / Purpose
      Device                    College existing network Structure
      Linkcode                  Supports the topology of the linkcode
      Switch                    Access of client in the web app
      Access Point              Testing Ensures high-speed and stable LAN
      Ethernet Cables           messaging.
      (Cat5e/Cat6)

F. Optional Devices

           Device               Purpose

           VoIP Headsets        For optional voice communication features.

           Backup Storage / NAS For database backups and log archiving.
3.4 Testing

         The testing phase ensures that MSUkaIP functions reliably under real-world academic
conditions. It directly supports the project's objective of evaluating system performance and
usability within the CICS LAN environment. Testing focuses on message delivery speed, VoIP
quality, system accessibility, and user satisfaction.

3.4.1 respondents

         Respondents are selected from the College of Information and Computing Sciences to
ensure that the system is tested by its actual end-users. Their experience with digital tools and
familiarity with academic communication provide relevant and accurate feedback.

Respondent Groups:

    1. Students (3rd-4th year IT and CS)
               They frequently rely on online platforms for group work, file sharing, and
                   communication.
               They will evaluate usability, responsiveness, and communication reliability.

    2. Faculty Members
               They assess how the system supports class announcements, academic
                   coordination, and message clarity.

    3. CICS Network Administrators
               They evaluate system behavior on the LAN, VoIP performance, and server load
                   handling.

A total of 20-30 respondents will participate in functional testing and system evaluation.

3.4.2 procedure
System Testing Procedure

      Stage                                        Description
Preparation
             Respondents from the College of Information and Computing Sciences
             (students, faculty, administrators) are identified. They are provided with
             instructions and given access to the system within the LAN environment.
Test Execution  Respondents perform the system's core functions, including logging in,
                sending and receiving messages, joining channels, uploading and
Observation     downloading files, and conducting VoIP call tests (if applicable).
Evaluation
Data            System behavior is monitored for speed, usability, connectivity, and errors.
Consolidation   Any issues encountered by the respondents are documented.

                Respondents complete the evaluation questionnaire, providing ratings on
                functionality, usability, performance, and system reliability.

                All responses are compiled, and results are summarized into tables to be
                presented in Chapter 4.

3.4.3 tools (questionnaire)
         A structured questionnaire is used to evaluate system performance and user experience.

This tool ensures standardized data collection and aligns with the theories presented in Chapter 2,
particularly Social Presence Theory and Channel Expansion Theory, which emphasize user
perception and familiarity.
Questionnaire Components:
A. System Usability

    � Ease of navigating the interface
    � Clarity of functions and menus
    � Comfort level using MSUkaIP for academic communication
B. Functionality
    � Accuracy of message delivery
    � File transfer success rate
    � Quality of voice communication
C. Performance
    � System speed
    � Stability within the CICS LAN
    � Responsiveness under multiple-user access

                42
D. User Satisfaction
    � How well the system met academic communication needs
    � Comparison with internet-dependent messaging platforms

Measurement Tool:
A 5-point Likert Scale is used:
Scale Description
5 Strongly Agree
4 Agree
3 Neutral
2 Disagree
1 Strongly Disagree
This ensures quantifiable results that can be analyzed objectively.
