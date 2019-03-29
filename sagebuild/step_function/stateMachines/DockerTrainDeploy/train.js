var fs=require('fs')
var _=require('lodash')
var Promise=require('bluebird')
var build=require('./build').build
var rollback=require('./rollback')

module.exports=Object.assign(
    build('Training',"IfHPO"),
    {"IfTrain":{
        Type:"Choice",
        Choices:[{
            Variable:`$.params.train`,
            BooleanEquals:true,
            Next:`getTrainingConfig` 
        },{
            Variable:`$.params.train`,
            BooleanEquals:false,
            Next:`getModelConfig` 
        },{
            Variable:`$.params.skiptrain`,
            BooleanEquals:true,
            Next:`getArtifact` 
        }],
        Default:`getTrainingConfig`
    },
    "getArtifact":{
        Type:"Task",
        Resource:"${StepLambdaGetArtifact.Arn}",
        Next:"getModelConfig",
    },
    "getTrainingConfig":{
        Type:"Task",
        InputPath:"$",
        Resource:"${LambdaVariables.TrainingConfig}",
        ResultPath:"$.args.training",
        Next:"getDataConfig"
    },
    "getDataConfig":{
        Type:"Task",
        Resource:"${StepLambdaGetDataConfig.Arn}",
        ResultPath:'$.args.training.InputDataConfig',
        Next:"IfBuildTraining"
    },
    "IfHPO":{
        Type:"Choice",
        Choices:[{
            Variable:`$.params.configtrain`,
            StringEquals:"SAGEMAKER",
            Next:`StartTraining` 
        },{
            Variable:`$.params.configtrain`,
            StringEquals:"SAGEMAKERHPO",
            Next:`StartHPO` 
        }],
        Default:`StartTraining`
    },
    "StartTraining":{
        Type:"Task",
        InputPath:"$",
        Resource:"${StepLambdaStartTraining.Arn}",
        ResultPath:"$.outputs.training",
        Next:"waitForTraining"
    },
    "StartHPO":{
        Type:"Task",
        InputPath:"$",
        Resource:"${StepLambdaStartHPO.Arn}",
        ResultPath:"$.outputs.training",
        Next:"waitForTraining"
    },
    "waitForTraining":{
        Type:"Wait",
        Seconds:30,
        Next:"IfHPOStatus"
    },
    "IfHPOStatus":{
        Type:"Choice",
        Choices:[{
            Variable:`$.params.configtrain`,
            StringEquals:"SAGEMAKER",
            Next:"getTrainingStatus"
        },{
            Variable:`$.params.configtrain`,
            StringEquals:"SAGEMAKERHPO",
            Next:"getHPOStatus"
        }],
        Default:"getHPOStatus"
    },
    "getTrainingStatus":{
        Type:"Task",
        Resource:"${StepLambdaTrainingStatus.Arn}",
        ResultPath:"$.status.training",
        Next:"checkTrainingStatus"
    },
    "getHPOStatus":{
        Type:"Task",
        Resource:"${StepLambdaHPOStatus.Arn}",
        ResultPath:"$.status.training",
        Next:"checkHPOStatus"
    },
    "checkTrainingStatus":{
        Type:"Choice",
        Choices:[{
            Variable:`$.status.training.TrainingJobStatus`,
            StringEquals:"InProgress",
            Next:`waitForTraining` 
        },{
            Variable:`$.status.training.TrainingJobStatus`,
            StringEquals:"Completed",
            Next:`getModelConfig` 
        }],
        Default:`trainingFail`
    },
    "checkHPOStatus":{
        Type:"Choice",
        Choices:[{
            Variable:`$.status.training.HyperParameterTuningJobStatus`,
            StringEquals:"InProgress",
            Next:`waitForTraining` 
        },{
            Variable:`$.status.training.HyperParameterTuningJobStatus`,
            StringEquals:"Completed",
            Next:`getModelConfig` 
        }],
        Default:`trainingFail`
    },
    "trainingFail":{
        Type:"Task",
        Resource:"${StepLambdaNotificationFail.Arn}",
        Next:"Fail"
    }}
)


